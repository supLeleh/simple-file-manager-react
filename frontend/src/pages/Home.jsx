import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Button, Alert, Badge, Form, Spinner, Row, Col, ProgressBar } from 'react-bootstrap';

const API_BASE = 'http://localhost:8000/ixp';
const CONFIGS_API = 'http://localhost:5000/configs';

const Home = () => {
    const [labStatus, setLabStatus] = useState('stopped');
    const [message, setMessage] = useState('');
    const [confFiles, setConfFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('ixp.conf');
    const [devices, setDevices] = useState([]);
    const [statsPollingEnabled, setStatsPollingEnabled] = useState(true);

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
        pollingRef.current = setInterval(fetchLabStatus, 5000);

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
            statsPollingRef.current = setInterval(fetchDevices, 5000);
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
            // Se c'è un lab attivo, avvisa l'utente
            if (labStatus === 'running') {
                if (!window.confirm('A lab is already running. It will be stopped before starting the new one. Continue?')) {
                    return;
                }
            }
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
        </Container>
    );
};

export default Home;
