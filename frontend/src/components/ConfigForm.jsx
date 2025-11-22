import React, { useState, useEffect } from 'react';
import { Form, Row, Col, Button, Card, Accordion } from 'react-bootstrap';

const ConfigForm = ({ initialData, onSave, onCancel, isEditing = false }) => {
  const getInitialConfig = () => {
    if (isEditing && initialData) {
      try {
        return typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
      } catch (e) {
        console.error('Errore nel parsing del config:', e);
      }
    }
    // Config vuoto per creazione nuovo file
    return {
      scenario_name: '',
      host_interface: null,
      peering_lan: { '4': '', '6': '' },
      peering_configuration: { type: 'ixp_manager', path: '' },
      rib_dumps: {
        type: 'open_bgpd',
        dumps: { '4': '', '6': '' }
      },
      route_servers: {}
    };
  };

  const [config, setConfig] = useState(getInitialConfig());

  useEffect(() => {
    if (isEditing && initialData) {
      try {
        const parsed = typeof initialData === 'string' 
          ? JSON.parse(initialData) 
          : initialData;
        setConfig(parsed);
      } catch (e) {
        console.error('Errore nel parsing del config:', e);
      }
    }
  }, [initialData, isEditing]);

  const handleChange = (path, value) => {
    setConfig(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const addRouteServer = () => {
    const rsName = `rs${Object.keys(config.route_servers).length + 1}`;
    setConfig(prev => ({
      ...prev,
      route_servers: {
        ...prev.route_servers,
        [rsName]: {
          type: 'open_bgpd',
          image: 'kathara/openbgpd',
          name: rsName,
          as_num: 0,
          config: '',
          address: ''
        }
      }
    }));
  };

  const removeRouteServer = (rsKey) => {
    setConfig(prev => {
      const updated = { ...prev };
      delete updated.route_servers[rsKey];
      return updated;
    });
  };

  const updateRouteServer = (rsKey, field, value) => {
    setConfig(prev => ({
      ...prev,
      route_servers: {
        ...prev.route_servers,
        [rsKey]: {
          ...prev.route_servers[rsKey],
          [field]: field === 'as_num' ? parseInt(value) || 0 : value
        }
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(JSON.stringify(config, null, 4));
  };

  return (
    <Form onSubmit={handleSubmit}>
      {/* Sezione Basic Info */}
      <Card className="mb-3">
        <Card.Header><strong>Informazioni Base</strong></Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Scenario Name *</Form.Label>
            <Form.Control
              type="text"
              value={config.scenario_name}
              onChange={(e) => handleChange('scenario_name', e.target.value)}
              placeholder="Esempio: namex_ixp, rome_ixp, milan_ixp"
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Host Interface</Form.Label>
            <Form.Control
              type="text"
              value={config.host_interface || ''}
              onChange={(e) => handleChange('host_interface', e.target.value || null)}
              placeholder="Esempio: eth0, wlan0 (opzionale, lascia vuoto per null)"
            />
            <Form.Text className="text-muted">
              Lascia vuoto se non necessario
            </Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* Sezione Peering LAN */}
      <Card className="mb-3">
        <Card.Header><strong>Peering LAN *</strong></Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>IPv4 Network</Form.Label>
                <Form.Control
                  type="text"
                  value={config.peering_lan['4']}
                  onChange={(e) => handleChange('peering_lan.4', e.target.value)}
                  placeholder="Esempio: 193.201.28.0/23"
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>IPv6 Network</Form.Label>
                <Form.Control
                  type="text"
                  value={config.peering_lan['6']}
                  onChange={(e) => handleChange('peering_lan.6', e.target.value)}
                  placeholder="Esempio: 2001:7f8:10::/48"
                  required
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Sezione Peering Configuration */}
      <Card className="mb-3">
        <Card.Header><strong>Peering Configuration</strong></Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Type</Form.Label>
                <Form.Select
                  value={config.peering_configuration.type}
                  onChange={(e) => handleChange('peering_configuration.type', e.target.value)}
                >
                  <option value="ixp_manager">IXP Manager</option>
                  <option value="custom">Custom</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Config Path</Form.Label>
                <Form.Control
                  type="text"
                  value={config.peering_configuration.path}
                  onChange={(e) => handleChange('peering_configuration.path', e.target.value)}
                  placeholder="Esempio: config_peerings.json, peerings.json"
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Sezione RIB Dumps */}
      <Card className="mb-3">
        <Card.Header><strong>RIB Dumps</strong></Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Type</Form.Label>
            <Form.Select
              value={config.rib_dumps.type}
              onChange={(e) => handleChange('rib_dumps.type', e.target.value)}
            >
              <option value="open_bgpd">OpenBGPD</option>
              <option value="bird">BIRD</option>
              <option value="frr">FRR</option>
            </Form.Select>
          </Form.Group>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>IPv4 Dump File</Form.Label>
                <Form.Control
                  type="text"
                  value={config.rib_dumps.dumps['4']}
                  onChange={(e) => handleChange('rib_dumps.dumps.4', e.target.value)}
                  placeholder="Esempio: rib_v4.dump, dump_ipv4.dump"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>IPv6 Dump File</Form.Label>
                <Form.Control
                  type="text"
                  value={config.rib_dumps.dumps['6']}
                  onChange={(e) => handleChange('rib_dumps.dumps.6', e.target.value)}
                  placeholder="Esempio: rib_v6.dump, dump_ipv6.dump"
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Sezione Route Servers */}
      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Route Servers *</strong>
          <Button size="sm" variant="success" onClick={addRouteServer}>
            + Aggiungi Route Server
          </Button>
        </Card.Header>
        <Card.Body>
          {Object.keys(config.route_servers).length === 0 ? (
            <div className="text-center p-3" style={{color: 'hsl(200, 50%, 60%)'}}>
              <p className="mb-2">Nessun route server configurato.</p>
              <p className="mb-0"><small>Clicca su "Aggiungi Route Server" per iniziare.</small></p>
            </div>
          ) : (
            <Accordion defaultActiveKey="0">
              {Object.entries(config.route_servers).map(([rsKey, rsData], idx) => (
                <Accordion.Item eventKey={idx.toString()} key={rsKey}>
                  <Accordion.Header>
                    <strong>{rsKey}</strong> 
                    {rsData.name && <span className="ms-2 text-muted">({rsData.name})</span>}
                  </Accordion.Header>
                  <Accordion.Body>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Name *</Form.Label>
                          <Form.Control
                            type="text"
                            value={rsData.name}
                            onChange={(e) => updateRouteServer(rsKey, 'name', e.target.value)}
                            placeholder="Esempio: rs1_v4, rs2_v6"
                            required
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Type</Form.Label>
                          <Form.Select
                            value={rsData.type}
                            onChange={(e) => updateRouteServer(rsKey, 'type', e.target.value)}
                          >
                            <option value="open_bgpd">OpenBGPD</option>
                            <option value="bird">BIRD</option>
                            <option value="frr">FRR</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Docker Image</Form.Label>
                          <Form.Control
                            type="text"
                            value={rsData.image}
                            onChange={(e) => updateRouteServer(rsKey, 'image', e.target.value)}
                            placeholder="Esempio: kathara/openbgpd, kathara/bird"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>AS Number *</Form.Label>
                          <Form.Control
                            type="number"
                            value={rsData.as_num}
                            onChange={(e) => updateRouteServer(rsKey, 'as_num', e.target.value)}
                            placeholder="Esempio: 196959, 65000"
                            required
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Config File</Form.Label>
                          <Form.Control
                            type="text"
                            value={rsData.config}
                            onChange={(e) => updateRouteServer(rsKey, 'config', e.target.value)}
                            placeholder="Esempio: rs1-rom-v4.conf, rs-config.conf"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>IP Address *</Form.Label>
                          <Form.Control
                            type="text"
                            value={rsData.address}
                            onChange={(e) => updateRouteServer(rsKey, 'address', e.target.value)}
                            placeholder="Esempio: 193.201.28.60, 2001:7f8:10::1"
                            required
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Button 
                      size="sm" 
                      variant="danger" 
                      onClick={() => removeRouteServer(rsKey)}
                    >
                      Rimuovi questo Route Server
                    </Button>
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Card.Body>
      </Card>

      {/* Bottoni azione */}
      <div className="d-flex justify-content-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annulla
        </Button>
        <Button variant="primary" type="submit">
          {isEditing ? 'Salva Modifiche' : 'Crea Config'}
        </Button>
      </div>
    </Form>
  );
};

export default ConfigForm;
