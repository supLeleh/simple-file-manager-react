const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs'); // Per controlli sincroni
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const CONFIGS_DIR = path.join(__dirname, 'ixpconfigs');
const RESOURCES_DIR = path.join(__dirname, 'resources');

// Crea le directory se non esistono
[CONFIGS_DIR, RESOURCES_DIR].forEach(dir => {
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir);
  }
});

// Validazione struttura JSON per CONFIG
const validateConfigJSON = (data) => {
  try {
    const parsed = JSON.parse(data);
    // Verifica struttura base richiesta (puoi personalizzare)
    if (!parsed.hasOwnProperty('name') || !parsed.hasOwnProperty('settings')) {
      return { valid: false, error: 'CONFIG deve avere "name" e "settings"' };
    }
    return { valid: true, parsed };
  } catch (e) {
    return { valid: false, error: 'JSON non valido' };
  }
};

// ========== ROUTES PER CONFIG ==========

// GET tutti i config
app.get('/configs', async (req, res) => {
  try {
    const files = await fs.readdir(CONFIGS_DIR);
    const fileContents = await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async (filename) => {
        const content = await fs.readFile(path.join(CONFIGS_DIR, filename), 'utf-8');
        return { name: filename, content, type: 'config' };
      })
    );
    res.json(fileContents);
  } catch (err) {
    res.status(500).send('Errore nel caricamento dei config');
  }
});

// PUT crea un nuovo config
app.put('/configs', async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name) return res.status(400).send('Nome file obbligatorio');
    if (!name.endsWith('.json')) return res.status(400).send('CONFIG deve avere estensione .json');
    
    const validation = validateConfigJSON(content);
    if (!validation.valid) {
      return res.status(400).send(validation.error);
    }
    
    const filePath = path.join(CONFIGS_DIR, name);
    if (fsSync.existsSync(filePath)) {
      return res.status(409).send('File già esistente');
    }
    
    // Salva JSON formattato
    await fs.writeFile(filePath, JSON.stringify(validation.parsed, null, 2));
    res.status(201).send('Config creato');
  } catch (err) {
    res.status(500).send('Errore nella creazione del config');
  }
});

// POST modifica un config esistente
app.post('/configs/:name', async (req, res) => {
  try {
    const fileName = req.params.name;
    const { content } = req.body;
    const filePath = path.join(CONFIGS_DIR, fileName);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).send('Config non trovato');
    }
    
    const validation = validateConfigJSON(content);
    if (!validation.valid) {
      return res.status(400).send(validation.error);
    }
    
    await fs.writeFile(filePath, JSON.stringify(validation.parsed, null, 2));
    res.send('Config aggiornato');
  } catch (err) {
    res.status(500).send('Errore nell\'aggiornamento del config');
  }
});

// DELETE elimina un config
app.delete('/configs/:name', async (req, res) => {
  try {
    const fileName = req.params.name;
    const filePath = path.join(CONFIGS_DIR, fileName);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).send('Config non trovato');
    }
    
    await fs.unlink(filePath);
    res.send('Config eliminato');
  } catch (err) {
    res.status(500).send('Errore nell\'eliminazione del config');
  }
});

// ========== ROUTES PER RESOURCES ==========

// GET tutti i resources
app.get('/resources', async (req, res) => {
  try {
    const files = await fs.readdir(RESOURCES_DIR);
    const fileContents = await Promise.all(
      files.map(async (filename) => {
        const content = await fs.readFile(path.join(RESOURCES_DIR, filename), 'utf-8');
        return { name: filename, content, type: 'resource' };
      })
    );
    res.json(fileContents);
  } catch (err) {
    res.status(500).send('Errore nel caricamento dei resources');
  }
});

// PUT crea un nuovo resource
app.put('/resources', async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name) return res.status(400).send('Nome file obbligatorio');
    
    const filePath = path.join(RESOURCES_DIR, name);
    if (fsSync.existsSync(filePath)) {
      return res.status(409).send('File già esistente');
    }
    
    await fs.writeFile(filePath, content || '');
    res.status(201).send('Resource creato');
  } catch (err) {
    res.status(500).send('Errore nella creazione del resource');
  }
});

// POST modifica un resource esistente
app.post('/resources/:name', async (req, res) => {
  try {
    const fileName = req.params.name;
    const { content } = req.body;
    const filePath = path.join(RESOURCES_DIR, fileName);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).send('Resource non trovato');
    }
    
    await fs.writeFile(filePath, content || '');
    res.send('Resource aggiornato');
  } catch (err) {
    res.status(500).send('Errore nell\'aggiornamento del resource');
  }
});

// DELETE elimina un resource
app.delete('/resources/:name', async (req, res) => {
  try {
    const fileName = req.params.name;
    const filePath = path.join(RESOURCES_DIR, fileName);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).send('Resource non trovato');
    }
    
    await fs.unlink(filePath);
    res.send('Resource eliminato');
  } catch (err) {
    res.status(500).send('Errore nell\'eliminazione del resource');
  }
});

app.listen(PORT, () => {
  console.log(`Backend server in ascolto su http://localhost:${PORT}`);
});
