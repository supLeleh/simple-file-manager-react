import React, { useState, useEffect } from 'react';
import { Button, Form, ListGroup, Modal, Alert, Tabs, Tab } from 'react-bootstrap';

const FileManager = () => {
  const [configs, setConfigs] = useState([]);
  const [resources, setResources] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentFile, setCurrentFile] = useState({ name: '', content: '' });
  const [fileType, setFileType] = useState('config'); // 'config' o 'resource'
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('configs');

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
      // Template per nuovo file CONFIG
      const template = type === 'config' 
        ? { name: 'nuovo-config.json', content: JSON.stringify({ name: "", settings: {} }, null, 2) }
        : { name: 'nuovo-resource.txt', content: '' };
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

  const renderFileList = (files, type) => (
    <ListGroup className="mt-3">
      {files.length === 0 ? (
        <ListGroup.Item className="text-center text-muted">
          Nessun file presente
        </ListGroup.Item>
      ) : (
        files.map((file, idx) => (
          <ListGroup.Item key={idx}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{file.name}</strong>
                {type === 'config' && <span className="badge bg-info ms-2">JSON</span>}
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
      <h1>File Manager - IXP</h1>
      
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        <Tab eventKey="configs" title="Configurations (JSON)">
          <Button variant="primary" onClick={() => handleShowModal(null, 'config')}>
            Nuovo Config
          </Button>
          {renderFileList(configs, 'config')}
        </Tab>

        <Tab eventKey="resources" title="Resources (TXT)">
          <Button variant="primary" onClick={() => handleShowModal(null, 'resource')}>
            Nuovo Resource
          </Button>
          {renderFileList(resources, 'resource')}
        </Tab>
      </Tabs>

      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Modifica' : 'Crea'} {fileType === 'config' ? 'Config' : 'Resource'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Nome file</Form.Label>
              <Form.Control
                name="name"
                value={currentFile.name}
                onChange={handleChange}
                disabled={isEditing}
              />
              {fileType === 'config' && (
                <Form.Text className="text-muted">
                  Deve terminare con .json
                </Form.Text>
              )}
            </Form.Group>
            <Form.Group className="mt-3">
              <Form.Label>
                Contenuto {fileType === 'config' && '(JSON)'}
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={fileType === 'config' ? 12 : 6}
                name="content"
                value={currentFile.content}
                onChange={handleChange}
                style={{ fontFamily: 'monospace', fontSize: '14px' }}
              />
              {fileType === 'config' && (
                <Form.Text className="text-muted">
                  Struttura richiesta: {`{ "name": "...", "settings": {...} }`}
                </Form.Text>
              )}
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditing ? 'Salva modifiche' : 'Crea'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FileManager;
