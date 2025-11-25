import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Button, Alert, Badge, Form, Spinner, Row, Col, ProgressBar, Modal } from 'react-bootstrap';

const API_BASE = 'http://localhost:8000/ixp';
const CONFIGS_API = 'http://localhost:5000/configs';

const Home = () => {
    const [labStatus, setLabStatus] = useState('stopped');
    const [message, setMessage] = useState('');
    const [confFiles, setConfFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('ixp.conf');
    const [devices, setDevices] = useState([]);
    const [statsPollingEnabled, setStatsPollingEnabled] = useState(true);

    // Stati per Run Command
    const [showCommandModal, setShowCommandModal] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [command, setCommand] = useState('');
    const [commandOutput, setCommandOutput] = useState('');
    const [commandLoading, setCommandLoading] = useState(false);
    const [commandError, setCommandError] = useState('');

    const pollingRef = useRef(null);
    const statsPollingRef = useRef(null);

    const fetchConfigFiles = async () => {
        try {
            const res = await fetch(CONFIGS_API);
            if (!res.ok) return;
            const data = await res.json();
            const confNames = data.filter(f => f.name.endsWith('.conf')).map(f => f.name);
            setConfFiles(confNames);
            if (confNames.length > 0 && !confNames.includes(selectedFile)) {
                setSelectedFile(confNames[0]);
            }
        } catch (e) {
            console.error('Error loading config files:', e);
        }
    };

    const fetchLabStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/running`);
            if (!res.ok) {
                setLabStatus('stopped');
                setDevices([]);
                return;
            }
            const data = await res.json();

            if (data.info && data.info.hash) {
                setLabStatus('running');
                setMessage(`Lab active. Hash: ${data.info.hash}`);
            } else {
                setLabStatus('stopped');
                setMessage('');
                setDevices([]);
            }
        } catch {
            setLabStatus('stopped');
            setMessage('');
            setDevices([]);
        }
    };

    const fetchDevices = async () => {
        if (labStatus !== 'running') return;

        try {
            const res = await fetch(`${API_BASE}/devices`);
            if (!res.ok) return;
            const data = await res.json();
            setDevices(data.devices || []);
        } catch (e) {
            console.error('Error loading devices:', e);
        }
    };

    useEffect(() => {
        fetchConfigFiles();
        fetchLabStatus();
        pollingRef.current = setInterval(fetchLabStatus, 10000); // Da 5s a 10s

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (statsPollingRef.current) {
            clearInterval(statsPollingRef.current);
            statsPollingRef.current = null;
        }

        if (labStatus === 'running' && statsPollingEnabled) {
            fetchDevices();
            statsPollingRef.current = setInterval(fetchDevices, 10000); // Da 5s a 10s
        }

        return () => {
            if (statsPollingRef.current) {
                clearInterval(statsPollingRef.current);
                statsPollingRef.current = null;
            }
        };
    }, [labStatus, statsPollingEnabled]);


    const handleStart = async () => {
        try {
            setLabStatus('starting');
            setMessage(`Starting Digital Twin with file ${selectedFile}...`);

            const res = await fetch(`${API_BASE}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: selectedFile }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Error starting lab');
            }

            const data = await res.json();
            setMessage(`Digital Twin started! Hash: ${data.lab_hash}`);
        } catch (error) {
            console.error('Error starting lab:', error);
            setLabStatus('stopped');
            setMessage(`Error starting lab: ${error.message}`);
        }
    };

    const handleStop = async () => {
        try {
            setLabStatus('stopping');
            setMessage('Stopping Digital Twin...');

            const res = await fetch(`${API_BASE}/wipe`, { method: 'POST' });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Error stopping lab');
            }

            setLabStatus('stopped');
            setMessage('Digital Twin stopped.');
            setDevices([]);
        } catch (error) {
            console.error('Error stopping lab:', error);
            setLabStatus('running');
            setMessage(`Error stopping lab: ${error.message}`);
        }
    };

    // ==================== RUN COMMAND FUNCTIONALITY ====================

    const handleOpenCommandModal = () => {
        setShowCommandModal(true);
        setCommand('');
        setCommandOutput('');
        setCommandError('');
        setSelectedDevice(devices.length > 0 ? devices[0].name : '');
    };

    const handleCloseCommandModal = () => {
        setShowCommandModal(false);
        setCommand('');
        setCommandOutput('');
        setCommandError('');
        setSelectedDevice('');
    };

    const handleExecuteCommand = async () => {
        if (!selectedDevice || !command.trim()) {
            setCommandError('Please select a device and enter a command');
            return;
        }

        setCommandLoading(true);
        setCommandError('');
        setCommandOutput('Executing command...');

        // Disabilita temporaneamente il polling
        const wasPollingEnabled = statsPollingEnabled;
        setStatsPollingEnabled(false);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const res = await fetch(`${API_BASE}/execute_command/${encodeURIComponent(selectedDevice)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(command.trim()),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'Error executing command');
            }

            const data = await res.json();
            const output = data.message || data.result || JSON.stringify(data);
            setCommandOutput(output);

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                setCommandError('Command execution timed out (60s limit)');
                setCommandOutput('Operation timeout. Check backend logs.');
            } else {
                console.error('Error executing command:', error);
                setCommandError(`Error: ${error.message}`);
            }
        } finally {
            setCommandLoading(false);
            // Riabilita il polling dopo 2 secondi
            setTimeout(() => {
                setStatsPollingEnabled(wasPollingEnabled);
            }, 2000);
        }
    };



    // ==================== END RUN COMMAND ====================

    const getStatusBadge = () => {
        const statusConfig = {
            stopped: { bg: 'secondary', text: 'Stopped' },
            starting: { bg: 'warning', text: 'Starting...' },
            running: { bg: 'success', text: 'Running' },
            stopping: { bg: 'warning', text: 'Stopping...' }
        };
        const config = statusConfig[labStatus];
        return <Badge bg={config.bg} className="fs-6">{config.text}</Badge>;
    };

    const getDeviceStatusBadge = (status) => {
        const statusMap = {
            'running': { bg: 'success', text: 'Running' },
            'stopped': { bg: 'danger', text: 'Stopped' },
            'error': { bg: 'warning', text: 'Error' },
            'not_found': { bg: 'secondary', text: 'Not Found' }
        };
        const config = statusMap[status] || { bg: 'secondary', text: 'Unknown' };
        return <Badge bg={config.bg}>{config.text}</Badge>;
    };

    const getProgressVariant = (percent) => {
        if (percent < 50) return 'success';
        if (percent < 80) return 'warning';
        return 'danger';
    };

    return (
        <Container className="py-5" style={{ maxWidth: '1200px' }}>
            {message && (
                <Alert
                    variant={labStatus === 'running' ? 'success' : labStatus === 'stopped' ? 'info' : 'warning'}
                    dismissible
                    onClose={() => setMessage('')}
                    className="mb-4"
                >
                    {message}
                </Alert>
            )}

            {/* Lab Control Card */}
            <Card style={{
                background: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                marginBottom: '1.5rem'
            }}>
                <Card.Header className="text-center" style={{
                    background: '#f8f9fa',
                    borderBottom: '1px solid #dee2e6',
                    padding: '1.5rem'
                }}>
                    <h3 style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#212529' }}>
                        IXP Lab Control
                    </h3>
                    {getStatusBadge()}
                </Card.Header>
                <Card.Body className="p-4">
                    <Row className="align-items-center mb-4">
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label style={{ fontWeight: 600, color: '#495057', marginBottom: '0.5rem' }}>
                                    Configuration File
                                </Form.Label>
                                <Form.Select
                                    value={selectedFile}
                                    onChange={e => setSelectedFile(e.target.value)}
                                    disabled={labStatus !== 'stopped'}
                                    style={{
                                        borderRadius: '6px',
                                        border: '1px solid #ced4da',
                                        padding: '0.6rem'
                                    }}
                                >
                                    {confFiles.map((file) => (
                                        <option key={file} value={file}>{file}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={8} className="text-center">
                            <div style={{
                                width: '100px',
                                height: '100px',
                                margin: '0 auto 1rem',
                                borderRadius: '50%',
                                background: labStatus === 'running'
                                    ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                                    : labStatus === 'stopped'
                                        ? '#f5f5f5'
                                        : 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
                                border: `3px solid ${labStatus === 'running'
                                    ? '#28a745'
                                    : labStatus === 'stopped'
                                        ? '#9e9e9e'
                                        : '#ffc107'
                                    }`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2.5rem',
                                boxShadow: labStatus === 'running'
                                    ? '0 4px 12px rgba(40, 167, 69, 0.3)'
                                    : labStatus === 'stopped'
                                        ? '0 2px 8px rgba(0,0,0,0.1)'
                                        : '0 4px 12px rgba(255, 193, 7, 0.3)',
                                transition: 'all 0.3s ease'
                            }}>
                                {labStatus === 'running' && '▶️'}
                                {labStatus === 'stopped' && '⏹️'}
                                {(labStatus === 'starting' || labStatus === 'stopping') && (
                                    <Spinner animation="border" variant="light" />
                                )}
                            </div>

                            <div className="d-flex gap-3 justify-content-center">
                                <Button
                                    variant="success"
                                    size="lg"
                                    onClick={handleStart}
                                    disabled={labStatus !== 'stopped'}
                                    style={{
                                        minWidth: '140px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        padding: '0.75rem 1.5rem',
                                        background: '#28a745',
                                        border: 'none'
                                    }}
                                >
                                    Start Lab
                                </Button>
                                <Button
                                    variant="danger"
                                    size="lg"
                                    onClick={handleStop}
                                    disabled={labStatus === 'stopped'}
                                    style={{
                                        minWidth: '140px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        padding: '0.75rem 1.5rem',
                                        background: '#dc3545',
                                        border: 'none'
                                    }}
                                >
                                    Stop Lab
                                </Button>
                            </div>

                            {/* Run Command Button - Solo se lab è running */}
                            {labStatus === 'running' && (
                                <div className="mt-3">
                                    <Button
                                        variant="primary"
                                        onClick={handleOpenCommandModal}
                                        style={{
                                            minWidth: '200px',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            padding: '0.5rem 1rem',
                                            background: '#007bff',
                                            border: 'none'
                                        }}
                                    >
                                        ⚡ Run Command
                                    </Button>
                                </div>
                            )}
                        </Col>
                    </Row>

                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid #dee2e6' }}>
                        <Row>
                            <Col md={12} className="text-center">
                                <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: 0 }}>
                                    {labStatus === 'stopped' && '💡 Lab is ready to start. Select a configuration file and press Start.'}
                                    {labStatus === 'starting' && 'Initializing containers and network configuration...'}
                                    {labStatus === 'running' && 'Lab is operational. All services are active.'}
                                    {labStatus === 'stopping' && 'Terminating processes and cleaning resources...'}
                                </p>
                            </Col>
                        </Row>
                    </div>
                </Card.Body>
            </Card>

            {/* Devices and Statistics Card */}
            {labStatus === 'running' && (
                <Card style={{
                    background: '#ffffff',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px'
                }}>
                    <Card.Header style={{
                        background: '#f8f9fa',
                        borderBottom: '1px solid #dee2e6',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h5 style={{ marginBottom: 0, fontWeight: 600, color: '#212529' }}>
                            Lab Devices ({devices.length})
                        </h5>
                        <Form.Check
                            type="switch"
                            id="stats-polling-switch"
                            label={
                                <span style={{ color: '#495057', fontWeight: 500 }}>
                                    Auto-refresh (5s)
                                    {statsPollingEnabled && (
                                        <Spinner animation="grow" size="sm" className="ms-2" variant="primary" />
                                    )}
                                </span>
                            }
                            checked={statsPollingEnabled}
                            onChange={(e) => setStatsPollingEnabled(e.target.checked)}
                            style={{ fontSize: '0.95rem' }}
                        />
                    </Card.Header>
                    <Card.Body style={{ padding: 0 }}>
                        {devices.length === 0 ? (
                            <div className="text-center p-5" style={{ color: '#6c757d' }}>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Loading devices...
                            </div>
                        ) : (
                            <div className="p-3">
                                {devices.map((device, idx) => (
                                    <Card key={idx} className="mb-3" style={{
                                        border: '1px solid #dee2e6',
                                        borderRadius: '6px'
                                    }}>
                                        <Card.Body className="p-3">
                                            <Row className="align-items-center mb-3">
                                                <Col md={6}>
                                                    <h6 style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#212529' }}>
                                                        {device.name}
                                                    </h6>
                                                    <div>
                                                        {getDeviceStatusBadge(device.status)}
                                                        <Badge bg="info" className="ms-2">
                                                            {device.interfaces} interfaces
                                                        </Badge>
                                                        <small className="ms-2 text-muted">Uptime: {device.uptime}</small>
                                                    </div>
                                                </Col>
                                                <Col md={6} className="text-md-end">
                                                    <small className="text-muted" style={{ fontWeight: 500 }}>
                                                        RX: {device.network_rx_mb} MB | TX: {device.network_tx_mb} MB
                                                    </small>
                                                </Col>
                                            </Row>

                                            <Row>
                                                <Col md={6} className="mb-2">
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <small style={{ fontWeight: 600, color: '#495057' }}>CPU</small>
                                                        <small style={{ fontWeight: 600, color: '#212529' }}>{device.cpu_percent}%</small>
                                                    </div>
                                                    <ProgressBar
                                                        now={device.cpu_percent}
                                                        variant={getProgressVariant(device.cpu_percent)}
                                                        style={{ height: '8px', borderRadius: '4px' }}
                                                    />
                                                </Col>
                                                <Col md={6} className="mb-2">
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <small style={{ fontWeight: 600, color: '#495057' }}>Memory</small>
                                                        <small style={{ fontWeight: 600, color: '#212529' }}>
                                                            {device.memory_usage_mb} / {device.memory_limit_mb} MB ({device.memory_percent}%)
                                                        </small>
                                                    </div>
                                                    <ProgressBar
                                                        now={device.memory_percent}
                                                        variant={getProgressVariant(device.memory_percent)}
                                                        style={{ height: '8px', borderRadius: '4px' }}
                                                    />
                                                </Col>
                                            </Row>
                                        </Card.Body>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Card.Body>
                </Card>
            )}

            <div className="text-center mt-5">
                <p style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                    ⚙️ Configure lab files in the <strong style={{ color: '#007bff' }}>Settings</strong> section
                </p>
            </div>

            {/* Run Command Modal */}
            <Modal show={showCommandModal} onHide={handleCloseCommandModal} size="lg">
                <Modal.Header closeButton style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                    <Modal.Title style={{ color: '#212529', fontWeight: 600 }}>
                        ⚡ Run Command on Device
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ background: '#ffffff' }}>
                    {commandError && (
                        <Alert variant="danger" onClose={() => setCommandError('')} dismissible>
                            {commandError}
                        </Alert>
                    )}

                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ fontWeight: 600, color: '#495057' }}>
                                Select Device
                            </Form.Label>
                            <Form.Select
                                value={selectedDevice}
                                onChange={(e) => setSelectedDevice(e.target.value)}
                                style={{ borderRadius: '6px', border: '1px solid #ced4da' }}
                            >
                                {devices.map((device) => (
                                    <option key={device.name} value={device.name}>
                                        {device.name} ({device.status})
                                    </option>
                                ))}
                            </Form.Select>
                            <Form.Text className="text-muted">
                                Select the device where you want to execute the command
                            </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label style={{ fontWeight: 600, color: '#495057' }}>
                                Command
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                placeholder="Example: ip addr show, ping -c 3 8.8.8.8, cat /etc/hostname"
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '13px',
                                    borderRadius: '6px',
                                    border: '1px solid #ced4da'
                                }}
                            />
                            <Form.Text className="text-muted">
                                Enter the command to execute on the selected device
                            </Form.Text>
                        </Form.Group>

                        {commandOutput && (
                            <Form.Group className="mb-3">
                                <Form.Label style={{ fontWeight: 600, color: '#495057' }}>
                                    Output
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={10}
                                    value={commandOutput}
                                    readOnly
                                    style={{
                                        fontFamily: 'monospace',
                                        fontSize: '12px',
                                        backgroundColor: '#f8f9fa',
                                        borderRadius: '6px',
                                        border: '1px solid #ced4da'
                                    }}
                                />
                            </Form.Group>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer style={{ background: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
                    <Button
                        variant="secondary"
                        onClick={handleCloseCommandModal}
                        style={{ background: '#6c757d', border: 'none', borderRadius: '6px' }}
                    >
                        Close
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleExecuteCommand}
                        disabled={commandLoading || !selectedDevice || !command.trim()}
                        style={{ background: '#007bff', border: 'none', borderRadius: '6px' }}
                    >
                        {commandLoading ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Executing...
                            </>
                        ) : (
                            '⚡ Execute Command'
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default Home;
