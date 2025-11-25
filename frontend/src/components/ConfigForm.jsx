import React, { useState, useEffect } from 'react';
import { Form, Row, Col, Button, Card, Accordion, Alert } from 'react-bootstrap';

const ConfigForm = ({ initialData, initialName = '', onSave, onCancel, isEditing = false }) => {
  // ==================== FUNZIONI DI VALIDAZIONE ====================
  
  const validateIPv4CIDR = (cidr) => {
    if (!cidr || cidr.trim() === '') return null;

    const regex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!regex.test(cidr)) {
      return 'Invalid IPv4 CIDR format (e.g., 192.168.1.0/24)';
    }

    const [ip, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr);

    if (prefix < 0 || prefix > 32) {
      return 'IPv4 prefix must be between 0 and 32';
    }

    const octets = ip.split('.').map(Number);
    if (octets.some(o => o < 0 || o > 255 || isNaN(o))) {
      return 'Invalid IPv4 address. Each octet must be 0-255';
    }

    // Controlla host bits
    const ipBinary = octets.reduce((acc, octet) => acc * 256 + octet, 0);
    const networkMask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const networkAddress = (ipBinary & networkMask) >>> 0;

    if (ipBinary !== networkAddress) {
      const correctOctets = [
        (networkAddress >>> 24) & 255,
        (networkAddress >>> 16) & 255,
        (networkAddress >>> 8) & 255,
        networkAddress & 255
      ];
      const correctCIDR = `${correctOctets.join('.')}/${prefix}`;
      return `Host bits set. Use ${correctCIDR} instead`;
    }

    return null;
  };

  const validateIPv6CIDR = (cidr) => {
    if (!cidr || cidr.trim() === '') return null;

    const regex = /^([0-9a-fA-F:]+)\/(\d{1,3})$/;
    if (!regex.test(cidr)) {
      return 'Invalid IPv6 CIDR format (e.g., 2001:db8::/32)';
    }

    const [ipv6, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr);

    if (prefix < 0 || prefix > 128) {
      return 'IPv6 prefix must be between 0 and 128';
    }

    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
    
    if (!ipv6Regex.test(ipv6)) {
      return 'Invalid IPv6 address format';
    }

    const normalized = ipv6.toLowerCase();
    if (prefix < 128 && !normalized.includes('::') && !normalized.endsWith(':0')) {
      return 'IPv6 network address should end with :: (e.g., 2001:db8::/32)';
    }

    return null;
  };

  const validateIPAddress = (ip) => {
    if (!ip || ip.trim() === '') return null;

    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      const octets = ip.split('.').map(Number);
      if (octets.every(o => o >= 0 && o <= 255)) {
        return null;
      }
      return 'Invalid IPv4 address. Each octet must be 0-255';
    }

    // IPv6
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){1,7}:$|^::(([0-9a-fA-F]{1,4}:){1,6}[0-9a-fA-F]{1,4})?$/;
    if (ipv6Regex.test(ip)) {
      return null;
    }

    return 'Invalid IP address format';
  };

  // ==================== FINE VALIDAZIONE ====================

  const getInitialConfig = () => {
    if (isEditing && initialData) {
      try {
        return typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
      } catch (e) {
        console.error('Errore nel parsing del config:', e);
      }
    }
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
  const [fileName, setFileName] = useState(initialName || '');
  const [errors, setErrors] = useState({});
  const [ipValidationErrors, setIpValidationErrors] = useState({}); // Nuovi errori per IP
  const [showValidationError, setShowValidationError] = useState(false);

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
    if (initialName) {
      setFileName(initialName);
    }
  }, [initialData, initialName, isEditing]);

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

    // Valida IP in tempo reale
    validateIPField(path, value);

    if (errors[path]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[path];
        return updated;
      });
    }
  };

  const validateIPField = (path, value) => {
    let error = null;

    if (path === 'peering_lan.4') {
      error = validateIPv4CIDR(value);
    } else if (path === 'peering_lan.6') {
      error = validateIPv6CIDR(value);
    }

    setIpValidationErrors(prev => {
      const updated = { ...prev };
      if (error) {
        updated[path] = error;
      } else {
        delete updated[path];
      }
      return updated;
    });
  };

  const handleFileNameChange = (e) => {
    setFileName(e.target.value);
    if (errors['fileName']) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated['fileName'];
        return updated;
      });
    }
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

    // Rimuovi errori IP del route server eliminato
    setIpValidationErrors(prev => {
      const updated = { ...prev };
      delete updated[`route_servers.${rsKey}.address`];
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

    // Valida indirizzo IP in tempo reale
    if (field === 'address') {
      const error = validateIPAddress(value);
      setIpValidationErrors(prev => {
        const updated = { ...prev };
        const errorKey = `route_servers.${rsKey}.address`;
        if (error) {
          updated[errorKey] = error;
        } else {
          delete updated[errorKey];
        }
        return updated;
      });
    }

    const errorKey = `route_servers.${rsKey}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Valida nome file
    if (!fileName || fileName.trim() === '') {
      newErrors['fileName'] = 'File name required';
    } else if (!fileName.endsWith('.conf')) {
      newErrors['fileName'] = 'File name must end with .conf';
    }

    // Valida scenario_name
    if (!config.scenario_name || config.scenario_name.trim() === '') {
      newErrors['scenario_name'] = true;
    }

    // Valida peering_lan con validazione IP
    const ipv4Error = validateIPv4CIDR(config.peering_lan['4']);
    const ipv6Error = validateIPv6CIDR(config.peering_lan['6']);
    
    if (!config.peering_lan['4'] || config.peering_lan['4'].trim() === '' || ipv4Error) {
      newErrors['peering_lan.4'] = true;
    }
    if (!config.peering_lan['6'] || config.peering_lan['6'].trim() === '' || ipv6Error) {
      newErrors['peering_lan.6'] = true;
    }

    // Valida route_servers
    if (Object.keys(config.route_servers).length === 0) {
      newErrors['route_servers'] = 'You must add at least one Route Server';
    } else {
      Object.entries(config.route_servers).forEach(([rsKey, rsData]) => {
        if (!rsData.name || rsData.name.trim() === '') {
          newErrors[`route_servers.${rsKey}.name`] = true;
        }
        if (!rsData.as_num || rsData.as_num === 0) {
          newErrors[`route_servers.${rsKey}.as_num`] = true;
        }
        
        const addressError = validateIPAddress(rsData.address);
        if (!rsData.address || rsData.address.trim() === '' || addressError) {
          newErrors[`route_servers.${rsKey}.address`] = true;
        }
      });
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    
    // Controlla anche errori IP
    const hasIPErrors = Object.keys(ipValidationErrors).length > 0;
    
    if (Object.keys(validationErrors).length > 0 || hasIPErrors) {
      setErrors(validationErrors);
      setShowValidationError(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setShowValidationError(false);
    onSave({
      name: fileName,
      content: JSON.stringify(config, null, 4)
    });
  };

  const hasError = (path) => errors.hasOwnProperty(path);
  const hasIPError = (path) => ipValidationErrors.hasOwnProperty(path);

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {showValidationError && (
        <Alert variant="danger" onClose={() => setShowValidationError(false)} dismissible>
          <Alert.Heading>Validation Errors</Alert.Heading>
          <p>Please fix all validation errors (marked in red) before saving.</p>
        </Alert>
      )}

      {/* Campo Nome File */}
      <Card className="mb-3" style={{ borderColor: hasError('fileName') ? '#dc3545' : '' }}>
        <Card.Header><strong>File Name *</strong></Card.Header>
        <Card.Body>
          <Form.Group>
            <Form.Label>Configuration file name</Form.Label>
            <Form.Control
              type="text"
              value={fileName}
              onChange={handleFileNameChange}
              placeholder="Example: ixp.conf, namex.conf, rome_ixp.conf"
              disabled={isEditing}
              isInvalid={hasError('fileName')}
            />
            {hasError('fileName') && (
              <Form.Control.Feedback type="invalid" style={{ display: 'block' }}>
                {errors['fileName']}
              </Form.Control.Feedback>
            )}
            <Form.Text className="text-muted">
              {isEditing 
                ? 'File name cannot be changed' 
                : 'Must end with .conf (e.g., ixp.conf)'}
            </Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* Sezione Basic Info */}
      <Card className="mb-3">
        <Card.Header><strong>Basic Information</strong></Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Scenario Name *</Form.Label>
            <Form.Control
              type="text"
              value={config.scenario_name}
              onChange={(e) => handleChange('scenario_name', e.target.value)}
              placeholder="Example: namex_ixp, rome_ixp, milan_ixp"
              isInvalid={hasError('scenario_name')}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Host Interface</Form.Label>
            <Form.Control
              type="text"
              value={config.host_interface || ''}
              onChange={(e) => handleChange('host_interface', e.target.value || null)}
              placeholder="Example: eth0, wlan0 (optional, leave empty for null)"
            />
            <Form.Text className="text-muted">
              Leave empty if not needed
            </Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* Sezione Peering LAN con validazione IP */}
      <Card className="mb-3">
        <Card.Header><strong>Peering LAN *</strong></Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  IPv4 Network * <span style={{ color: '#dc3545' }}>⚠</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  value={config.peering_lan['4']}
                  onChange={(e) => handleChange('peering_lan.4', e.target.value)}
                  placeholder="Example: 193.201.28.0/23"
                  isInvalid={hasError('peering_lan.4') || hasIPError('peering_lan.4')}
                />
                {hasIPError('peering_lan.4') && (
                  <Form.Control.Feedback type="invalid" style={{ display: 'block' }}>
                    {ipValidationErrors['peering_lan.4']}
                  </Form.Control.Feedback>
                )}
                {!hasIPError('peering_lan.4') && config.peering_lan['4'] && config.peering_lan['4'].trim() !== '' && (
                  <Form.Text className="text-success">
                    ✓ Valid IPv4 network address
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  IPv6 Network * <span style={{ color: '#dc3545' }}>⚠</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  value={config.peering_lan['6']}
                  onChange={(e) => handleChange('peering_lan.6', e.target.value)}
                  placeholder="Example: 2001:7f8:10::/48"
                  isInvalid={hasError('peering_lan.6') || hasIPError('peering_lan.6')}
                />
                {hasIPError('peering_lan.6') && (
                  <Form.Control.Feedback type="invalid" style={{ display: 'block' }}>
                    {ipValidationErrors['peering_lan.6']}
                  </Form.Control.Feedback>
                )}
                {!hasIPError('peering_lan.6') && config.peering_lan['6'] && config.peering_lan['6'].trim() !== '' && (
                  <Form.Text className="text-success">
                    ✓ Valid IPv6 network address
                  </Form.Text>
                )}
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
                  placeholder="Example: config_peerings.json, peerings.json"
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
                  placeholder="Example: rib_v4.dump, dump_ipv4.dump"
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
                  placeholder="Example: rib_v6.dump, dump_ipv6.dump"
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Sezione Route Servers con validazione IP */}
      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <strong>Route Servers *</strong>
            {errors['route_servers'] && (
              <span className="ms-2 text-danger" style={{ fontSize: '0.875rem' }}>
                ({errors['route_servers']})
              </span>
            )}
          </div>
          <Button size="sm" variant="success" onClick={addRouteServer}>
            + Add Route Server
          </Button>
        </Card.Header>
        <Card.Body>
          {Object.keys(config.route_servers).length === 0 ? (
            <div className="text-center p-3" style={{color: '#6c757d'}}>
              <p className="mb-2">No route servers configured.</p>
              <p className="mb-0"><small>Click "Add Route Server" to start.</small></p>
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
                            placeholder="Example: rs1_v4, rs2_v6"
                            isInvalid={hasError(`route_servers.${rsKey}.name`)}
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
                            placeholder="Example: kathara/openbgpd, kathara/bird"
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
                            placeholder="Example: 196959, 65000"
                            isInvalid={hasError(`route_servers.${rsKey}.as_num`)}
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
                            placeholder="Example: rs1-rom-v4.conf, rs-config.conf"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            IP Address * <span style={{ color: '#dc3545' }}>⚠</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            value={rsData.address}
                            onChange={(e) => updateRouteServer(rsKey, 'address', e.target.value)}
                            placeholder="Example: 193.201.28.60, 2001:7f8:10::1"
                            isInvalid={hasError(`route_servers.${rsKey}.address`) || hasIPError(`route_servers.${rsKey}.address`)}
                          />
                          {hasIPError(`route_servers.${rsKey}.address`) && (
                            <Form.Control.Feedback type="invalid" style={{ display: 'block' }}>
                              {ipValidationErrors[`route_servers.${rsKey}.address`]}
                            </Form.Control.Feedback>
                          )}
                          {!hasIPError(`route_servers.${rsKey}.address`) && rsData.address && rsData.address.trim() !== '' && (
                            <Form.Text className="text-success">
                              ✓ Valid IP address
                            </Form.Text>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>
                    <Button 
                      size="sm" 
                      variant="danger" 
                      onClick={() => removeRouteServer(rsKey)}
                    >
                      Remove this Route Server
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
          Cancel
        </Button>
        <Button 
          variant="primary" 
          type="submit"
          disabled={Object.keys(ipValidationErrors).length > 0}
        >
          {isEditing ? 'Save Changes' : 'Create Config'}
        </Button>
      </div>
    </Form>
  );
};

export default ConfigForm;
