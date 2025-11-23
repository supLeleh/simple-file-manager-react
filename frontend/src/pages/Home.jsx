import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Button, Alert, Badge, Form, Spinner, Table, ProgressBar, Row, Col } from 'react-bootstrap';

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

    // [... mantieni tutte le funzioni precedenti: fetchConfigFiles, fetchLabStatus, handleStart, handleStop ...]

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
            console.error('Errore caricando file config:', e);
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
                setMessage(`Lab attivo. Hash: ${data.info.hash}`);
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
            console.error('Errore caricando dispositivi:', e);
        }
    };

    useEffect(() => {
        fetchConfigFiles();
        fetchLabStatus();
        pollingRef.current = setInterval(fetchLabStatus, 5000);
        return () => clearInterval(pollingRef.current);
    }, []);

    // Polling dispositivi solo se abilitato E lab running
    useEffect(() => {
        // Pulisci eventuali polling precedenti
        if (statsPollingRef.current) {
            clearInterval(statsPollingRef.current);
            statsPollingRef.current = null;
        }

        // Avvia polling solo se lab running E auto-refresh abilitato
        if (labStatus === 'running' && statsPollingEnabled) {
            fetchDevices(); // Prima chiamata immediata
            statsPollingRef.current = setInterval(fetchDevices, 5000);
            console.log('Polling dispositivi AVVIATO');
        } else {
            console.log('Polling dispositivi FERMATO');
        }

        // Cleanup quando il componente viene smontato o dipendenze cambiano
        return () => {
            if (statsPollingRef.current) {
                clearInterval(statsPollingRef.current);
                statsPollingRef.current = null;
                console.log('Polling dispositivi PULITO');
            }
        };
    }, [labStatus, statsPollingEnabled]); // Dipendenze corrette


    const handleStart = async () => {
        try {
            setLabStatus('starting');
            setMessage(`Avvio del Digital Twin con file ${selectedFile} in corso...`);

            const res = await fetch(`${API_BASE}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: selectedFile }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Errore nell\'avvio del lab');
            }

            const data = await res.json();
            setMessage(`Digital Twin avviato! Hash: ${data.lab_hash}`);
        } catch (error) {
            console.error('Errore start lab:', error);
            setLabStatus('stopped');
            setMessage(`Errore durante l'avvio: ${error.message}`);
        }
    };

    const handleStop = async () => {
        try {
            setLabStatus('stopping');
            setMessage('Arresto del Digital Twin in corso...');

            const res = await fetch(`${API_BASE}/wipe`, {
                method: 'POST',
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Errore nell\'arresto del lab');
            }

            setLabStatus('stopped');
            setMessage('Digital Twin arrestato.');
            setDevices([]);
        } catch (error) {
            console.error('Errore stop lab:', error);
            setLabStatus('running');
            setMessage(`Errore durante l'arresto: ${error.message}`);
        }
    };

    const getStatusBadge = () => {
        const statusConfig = {
            stopped: { bg: 'secondary', text: 'Arrestato' },
            starting: { bg: 'warning', text: 'Avvio in corso...' },
            running: { bg: 'success', text: 'In esecuzione' },
            stopping: { bg: 'warning', text: 'Arresto in corso...' }
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
        <Container className="py-5">
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

            <Form.Group className="mb-4" style={{ maxWidth: 300, margin: '0 auto' }}>
                <Form.Label>Seleziona file di configurazione IXP (.conf):</Form.Label>
                <Form.Select
                    value={selectedFile}
                    onChange={e => setSelectedFile(e.target.value)}
                    disabled={labStatus !== 'stopped'}
                >
                    {confFiles.map((file) => (
                        <option key={file} value={file}>{file}</option>
                    ))}
                </Form.Select>
            </Form.Group>

            <Card style={{
                background: '#ffffff',
                border: '1px solid #e0e0e0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                maxWidth: '600px',
                margin: '0 auto'
            }}>
                <Card.Header className="text-center" style={{
                    background: '#ffffff',
                    borderBottom: '1px solid #e0e0e0',
                    padding: '1.5rem'
                }}>
                    <h3 style={{ color: '#333', marginBottom: '1rem', fontWeight: 600 }}>
                        Stato del Lab
                    </h3>
                    {getStatusBadge()}
                </Card.Header>
                <Card.Body className="text-center p-5">
                    <div className="mb-4">
                        <div style={{
                            width: '120px',
                            height: '120px',
                            margin: '0 auto 2rem',
                            borderRadius: '50%',
                            background: labStatus === 'running'
                                ? '#e8f5e9'
                                : labStatus === 'stopped'
                                    ? '#f5f5f5'
                                    : '#fff3e0',
                            border: `3px solid ${labStatus === 'running'
                                ? '#4caf50'
                                : labStatus === 'stopped'
                                    ? '#9e9e9e'
                                    : '#ff9800'
                                }`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3rem'
                        }}>
                            {labStatus === 'running' && '▶️'}
                            {labStatus === 'stopped' && '⏹️'}
                            {(labStatus === 'starting' || labStatus === 'stopping') && <Spinner animation="border" variant="warning" />}
                        </div>
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
                                boxShadow: 'none'
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
                                boxShadow: 'none'
                            }}
                        >
                            Stop Lab
                        </Button>
                    </div>

                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e0e0e0' }}>
                        <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            <strong>Info:</strong>
                        </p>
                        <p style={{ color: '#666', fontSize: '0.9rem' }}>
                            {labStatus === 'stopped' && 'Il laboratorio è pronto per essere avviato.'}
                            {labStatus === 'starting' && 'Inizializzazione dei container e configurazione rete...'}
                            {labStatus === 'running' && 'Il laboratorio è operativo. Tutti i servizi sono attivi.'}
                            {labStatus === 'stopping' && 'Terminazione dei processi e pulizia delle risorse...'}
                        </p>
                    </div>
                </Card.Body>
            </Card>

            {/* Sezione Dispositivi e Statistiche Dettagliate */}
            {labStatus === 'running' && (
                <Card className="mt-4" style={{
                    background: '#ffffff',
                    border: '1px solid #e0e0e0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}>
                    <Card.Header style={{
                        background: '#ffffff',
                        borderBottom: '1px solid #e0e0e0',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h5 style={{ color: '#333', marginBottom: 0, fontWeight: 600 }}>
                            📊 Dispositivi Lab ({devices.length})
                        </h5>
                        <Form.Check
                            type="switch"
                            id="stats-polling-switch"
                            label={
                                <span>
                                    Auto-refresh (5s)
                                    {statsPollingEnabled && labStatus === 'running' && (
                                        <Spinner animation="grow" size="sm" className="ms-2" variant="success" />
                                    )}
                                </span>
                            }
                            checked={statsPollingEnabled}
                            onChange={(e) => setStatsPollingEnabled(e.target.checked)}
                        />
                    </Card.Header>
                    <Card.Body style={{ padding: 0 }}>
                        {devices.length === 0 ? (
                            <div className="text-center p-4" style={{ color: '#999' }}>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Caricamento dispositivi...
                            </div>
                        ) : (
                            <div className="p-3">
                                {devices.map((device, idx) => (
                                    <Card key={idx} className="mb-3" style={{ border: '1px solid #e0e0e0' }}>
                                        <Card.Body>
                                            <Row className="align-items-center mb-3">
                                                <Col md={6}>
                                                    <h6 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                                                        🖥️ {device.name}
                                                    </h6>
                                                    <div>
                                                        {getDeviceStatusBadge(device.status)}
                                                        <Badge bg="info" className="ms-2">
                                                            {device.interfaces} interfacce
                                                        </Badge>
                                                        <small className="ms-2 text-muted">Uptime: {device.uptime}</small>
                                                    </div>
                                                </Col>
                                                <Col md={6} className="text-md-end">
                                                    <small className="text-muted">
                                                        📡 RX: {device.network_rx_mb} MB | TX: {device.network_tx_mb} MB
                                                    </small>
                                                </Col>
                                            </Row>

                                            <Row>
                                                <Col md={6} className="mb-2">
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <small style={{ fontWeight: 500 }}>CPU</small>
                                                        <small style={{ fontWeight: 600 }}>{device.cpu_percent}%</small>
                                                    </div>
                                                    <ProgressBar
                                                        now={device.cpu_percent}
                                                        variant={getProgressVariant(device.cpu_percent)}
                                                        style={{ height: '8px' }}
                                                    />
                                                </Col>
                                                <Col md={6} className="mb-2">
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <small style={{ fontWeight: 500 }}>Memoria</small>
                                                        <small style={{ fontWeight: 600 }}>
                                                            {device.memory_usage_mb} / {device.memory_limit_mb} MB ({device.memory_percent}%)
                                                        </small>
                                                    </div>
                                                    <ProgressBar
                                                        now={device.memory_percent}
                                                        variant={getProgressVariant(device.memory_percent)}
                                                        style={{ height: '8px' }}
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
                <p style={{ color: '#999' }}>
                    Configura i file di laboratorio nella sezione <strong style={{ color: '#1565c0' }}>Settings</strong>
                </p>
            </div>
        </Container>
    );
};

export default Home;
