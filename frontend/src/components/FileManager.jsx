import React, { useState, useEffect } from 'react';
import { Button, Form, ListGroup, Modal, Alert } from 'react-bootstrap';

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentFile, setCurrentFile] = useState({ name: '', content: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');

  const fetchFiles = async () => {
    try {
      const res = await fetch('http://localhost:5000/files');
      if (!res.ok) throw new Error('Errore nel caricamento dei file');
      const data = await res.json();
      setFiles(data);
      setError('');
    } catch (error) {
      setError('Impossibile caricare i file');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const createFile = async (file) => {
    try {
      const response = await fetch('http://localhost:5000/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchFiles();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nella creazione del file');
      console.error(error);
    }
  };

  const updateFile = async (file) => {
    try {
      const response = await fetch(`http://localhost:5000/files/${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: file.content }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchFiles();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nell\'aggiornamento del file');
      console.error(error);
    }
  };

  const deleteFile = async (fileName) => {
    try {
      const response = await fetch(`http://localhost:5000/files/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchFiles();
      setError('');
    } catch (error) {
      setError(error.message || 'Errore nell\'eliminazione del file');
      console.error(error);
    }
  };

  const handleShowModal = (file = null) => {
    if (file) {
      setCurrentFile({ ...file });
      setIsEditing(true);
    } else {
      setCurrentFile({ name: '', content: '' });
      setIsEditing(false);
    }
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
    
    if (isEditing) {
      await updateFile(currentFile);
    } else {
      await createFile(currentFile);
    }
    
    if (!error) {
      setShowModal(false);
    }
  };

  const handleDelete = (fileName) => {
    if (window.confirm(`Sei sicuro di voler eliminare "${fileName}"?`)) {
      deleteFile(fileName);
    }
  };

  return (
    <>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      
      <Button variant="primary" onClick={() => handleShowModal()}>Nuovo file</Button>
      
      <ListGroup className="mt-3">
        {files.map((file, idx) => (
          <ListGroup.Item key={idx}>
            <div className="d-flex justify-content-between align-items-center">
              <div>{file.name}</div>
              <div>
                <Button size="sm" onClick={() => handleShowModal(file)} className="mx-1">
                  Modifica
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(file.name)}>
                  Elimina
                </Button>
              </div>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
      
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? 'Modifica file' : 'Crea file'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Nome</Form.Label>
              <Form.Control
                name="name"
                value={currentFile.name}
                onChange={handleChange}
                disabled={isEditing}
              />
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Label>Contenuto</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                name="content"
                value={currentFile.content}
                onChange={handleChange}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>Annulla</Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditing ? 'Salva modifiche' : 'Crea'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FileManager;
