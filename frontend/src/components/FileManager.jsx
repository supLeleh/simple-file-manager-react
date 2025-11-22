import React, { useState, useEffect } from 'react';
import { Button, Form, ListGroup, Modal, Alert, Tabs, Tab, Badge } from 'react-bootstrap';
import ConfigForm from './ConfigForm';

const FileManager = () => {
  const [configs, setConfigs] = useState([]);
  const [resources, setResources] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentFile, setCurrentFile] = useState({ name: '', content: '' });
  const [fileType, setFileType] = useState('config');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('configs');

  // Template IXP Config
  const IXP_CONFIG_TEMPLATE = {
    scenario_name: "namex_ixp",
    host_interface: null,
    peering_lan: {
      "4": "193.201.28.0/23",
      "6": "2001:7f8:10::/48"
    },
    peering_configuration: {
      type: "ixp_manager",
      path: "config_peerings.json"
    },
    rib_dumps: {
      type: "open_bgpd",
      dumps: {
        "4": "rib_v4.dump",
        "6": "rib_v6.dump"
      }
    },
    route_servers: {
      rs1_v4: {
        type: "open_bgpd",
        image: "kathara/openbgpd",
        name: "rs1_v4",
        as_num: 196959,
        config: "rs1-rom-v4.conf",
        address: "193.201.28.60"
      },
      rs1_v6: {
        type: "open_bgpd",
        name: "rs1_v6",
        image: "kathara/openbgpd",
        as_num: 196959,
        config: "rs1-rom-v6.conf",
        address: "2001:7f8:10::19:6959"
      }
    }
  };

  // Funzioni per CONFIG
  const fetchConfigs = async () => {
    try {
      const res = await fetch('http://localhost:5000/configs');
      if (!res.ok) throw new Error('Errore nel caricamento dei config');
      const data = await res.json();
      setConfigs(data);
    } catch (error) {
      setError('Impossibile caricare i config');
      console.error(error);
    }
  };

  const createConfig = async (file) => {
    try {
      const response = await fetch('http://localhost:5000/configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchConfigs();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nella creazione del config');
    }
  };

  const updateConfig = async (file) => {
    try {
      const response = await fetch(`http://localhost:5000/configs/${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: file.content }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchConfigs();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nell\'aggiornamento del config');
    }
  };

  const deleteConfig = async (fileName) => {
    try {
      const response = await fetch(`http://localhost:5000/configs/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchConfigs();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nell\'eliminazione del config');
    }
  };

  // Funzioni per RESOURCES
  const fetchResources = async () => {
    try {
      const res = await fetch('http://localhost:5000/resources');
      if (!res.ok) throw new Error('Errore nel caricamento dei resources');
      const data = await res.json();
      setResources(data);
    } catch (error) {
      setError('Impossibile caricare i resources');
      console.error(error);
    }
  };

  const createResource = async (file) => {
    try {
      const response = await fetch('http://localhost:5000/resources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchResources();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nella creazione del resource');
    }
  };

  const updateResource = async (file) => {
    try {
      const response = await fetch(`http://localhost:5000/resources/${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: file.content }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchResources();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nell\'aggiornamento del resource');
    }
  };

  const deleteResource = async (fileName) => {
    try {
      const response = await fetch(`http://localhost:5000/resources/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchResources();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nell\'eliminazione del resource');
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchResources();
  }, []);

  const handleShowModal = (file = null, type = 'config') => {
    if (file) {
      setCurrentFile({ ...file });
      setIsEditing(true);
    } else {
      const template = type === 'config'
        ? {
          name: 'ixp.conf',
          content: JSON.stringify(IXP_CONFIG_TEMPLATE, null, 4)
        }
        : { name: 'nuovo-resource.json', content: '' };
      setCurrentFile(template);
      setIsEditing(false);
    }
    setFileType(type);
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setError('');
  };

  const handleChange = (e) => {
    setCurrentFile({ ...currentFile, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!currentFile.name.trim()) {
      setError('Il nome del file è obbligatorio');
      return;
    }

    if (fileType === 'config') {
      if (isEditing) {
        await updateConfig(currentFile);
      } else {
        await createConfig(currentFile);
      }
    } else {
      if (isEditing) {
        await updateResource(currentFile);
      } else {
        await createResource(currentFile);
      }
    }

    if (!error) {
      setShowModal(false);
    }
  };

  const handleDelete = (fileName, type) => {
    if (window.confirm(`Sei sicuro di voler eliminare "${fileName}"?`)) {
      if (type === 'config') {
        deleteConfig(fileName);
      } else {
        deleteResource(fileName);
      }
    }
  };

  const getFileExtensionBadge = (filename) => {
    const ext = filename.split('.').pop().toUpperCase();
    const colorMap = {
      'CONF': 'primary',
      'JSON': 'info',
      'DUMP': 'warning'
    };
    return <Badge bg={colorMap[ext] || 'secondary'}>{ext}</Badge>;
  };

  const renderFileList = (files, type) => (
    <ListGroup className="mt-3">
      {files.length === 0 ? (
        <ListGroup.Item className="text-center" style={{ color: 'hsl(200, 50%, 60%)' }}>
          Nessun file presente
        </ListGroup.Item>
      ) : (
        files.map((file, idx) => (
          <ListGroup.Item key={idx}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{file.name}</strong>
                <span className="ms-2">{getFileExtensionBadge(file.name)}</span>
              </div>
              <div>
                <Button
                  size="sm"
                  onClick={() => handleShowModal(file, type)}
                  className="mx-1"
                >
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(file.name, type)}
                >
                  Elimina
                </Button>
              </div>
            </div>
          </ListGroup.Item>
        ))
      )}
    </ListGroup>
  );

  return (
    <>
      <h1>IXP File Manager</h1>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        <Tab eventKey="configs" title={`IXP Configurations (${configs.length})`}>
          <Button variant="primary" onClick={() => handleShowModal(null, 'config')}>
            Nuovo Config (.conf)
          </Button>
          {renderFileList(configs, 'config')}
        </Tab>

        <Tab eventKey="resources" title={`Resources (${resources.length})`}>
          <Button variant="primary" onClick={() => handleShowModal(null, 'resource')}>
            Nuovo Resource
          </Button>
          {renderFileList(resources, 'resource')}
        </Tab>
      </Tabs>

      <Modal show={showModal} onHide={handleCloseModal} size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Modifica' : 'Crea'} {fileType === 'config' ? 'Config IXP' : 'Resource'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {fileType === 'config' ? (
            <ConfigForm
              initialData={currentFile.content}
              isEditing={isEditing}  // Passa la prop isEditing
              onSave={(jsonContent) => {
                setCurrentFile(prev => ({ ...prev, content: jsonContent }));
                handleSave();
              }}
              onCancel={handleCloseModal}
            />
          ) : (
            <Form>
              <Form.Group>
                <Form.Label>Nome file</Form.Label>
                <Form.Control
                  name="name"
                  value={currentFile.name}
                  onChange={handleChange}
                  disabled={isEditing}
                  placeholder="nome.json / nome.dump / nome.conf"
                />
                <Form.Text className="text-muted">
                  Estensioni valide: .json, .dump, .conf
                </Form.Text>
              </Form.Group>
              <Form.Group className="mt-3">
                <Form.Label>Contenuto</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={8}
                  name="content"
                  value={currentFile.content}
                  onChange={handleChange}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: '1.5'
                  }}
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        {fileType !== 'config' && (
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Annulla
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {isEditing ? 'Salva modifiche' : 'Crea'}
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
};

export default FileManager;
