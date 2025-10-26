const express = require("express");
const patchService = require("../services/patchService");
const router = express.Router();
const fileProcessor = require("../controllers/fileProcessor"); // import corrigé
router.post("/split", async (req, res) => {
  try {
    const { pdfPath, patchMode, lang, naming, namingPattern, ocrMode, containsPatch } = req.body;
    if (!pdfPath) return res.status(400).send("pdfPath est obligatoire");

    const results = await patchService.splitByPatch(pdfPath, {
      patchMode,
      lang,
      naming,
      namingPattern,
      ocrMode: ocrMode === 'true',
      containsPatch: containsPatch === 'true'
    });

    res.json({ success: true, results });
  } catch (err) {
    console.error("Erreur split:", err);
    res.status(500).json({ success: false, message: "Erreur split: " + err.message });
  }
});


router.post('/generatePatch', fileProcessor.generatePatchOnly);

module.exports = router;
