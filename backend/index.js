const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises; // Usa versione promise-based
const fsSync = require('fs'); // Per controlli sincroni
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const FILES_DIR = path.join(__dirname, 'files');

// Crea la directory se non esiste
if (!fsSync.existsSync(FILES_DIR)) {
  fsSync.mkdirSync(FILES_DIR);
}

// GET tutti i file (lista nomi e contenuti)
app.get('/files', async (req, res) => {
  try {
    const files = await fs.readdir(FILES_DIR);
    const fileContents = await Promise.all(
      files.map(async (filename) => {
        const content = await fs.readFile(path.join(FILES_DIR, filename), 'utf-8');
        return { name: filename, content };
      })
    );
    res.json(fileContents);
  } catch (err) {
    res.status(500).send('Errore nel caricamento dei file');
  }
});

// PUT crea un nuovo file
app.put('/files', async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name) return res.status(400).send('Nome file obbligatorio');
    
    const filePath = path.join(FILES_DIR, name);
    if (fsSync.existsSync(filePath)) {
      return res.status(409).send('File già esistente');
    }
    
    await fs.writeFile(filePath, content || '');
    res.status(201).send('File creato');
  } catch (err) {
    res.status(500).send('Errore nella creazione del file');
  }
});

// POST modifica un file esistente
app.post('/files/:name', async (req, res) => {
  try {
    const fileName = req.params.name;
    const { content } = req.body;
    const filePath = path.join(FILES_DIR, fileName);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).send('File non trovato');
    }
    
    await fs.writeFile(filePath, content || '');
    res.send('File aggiornato');
  } catch (err) {
    res.status(500).send('Errore nell\'aggiornamento del file');
  }
});

// DELETE elimina un file
app.delete('/files/:name', async (req, res) => {
  try {
    const fileName = req.params.name;
    const filePath = path.join(FILES_DIR, fileName);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).send('File non trovato');
    }
    
    await fs.unlink(filePath);
    res.send('File eliminato');
  } catch (err) {
    res.status(500).send('Errore nell\'eliminazione del file');
  }
});

app.listen(PORT, () => {
  console.log(`Backend server in ascolto su http://localhost:${PORT}`);
});
