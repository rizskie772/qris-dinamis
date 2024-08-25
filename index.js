const express = require('express');
const axios = require('axios');
const Jimp = require('jimp');
const QRCode = require('qrcode');
const { pad, toCRC16, dataQris } = require('./lib');
const path = require('path');

const app = express();

// URL file font dan template di GitHub
const FONT_BASE_URL = 'https://raw.githubusercontent.com/rizskie772/qris-dinamis/main/assets/font/';
const TEMPLATE_URL = 'https://raw.githubusercontent.com/rizskie772/qris-dinamis/main/assets/template.png';

// Fungsi untuk mendownload file dari URL dan mengembalikan buffer
async function downloadFile(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}

app.get('/generate-qr', async (req, res) => {
    try {
        let qris = req.query.qris;
        let nominal = req.query.nominal;
        let taxtype = req.query.taxtype || 'p';
        let fee = req.query.fee || '10';

        if (!qris || !nominal) {
            return res.status(400).send('Parameter qris dan nominal diperlukan');
        }

        // Generate the QR code data string
        let qris2 = qris.slice(0, -4);
        let replaceQris = qris2.replace("010211", "010212");
        let pecahQris = replaceQris.split("5802ID");
        let uang = "54" + pad(nominal.length) + nominal;
        let tax = (taxtype === 'p') ? "55020357" + pad(fee.length) + fee : "55020256" + pad(fee.length) + fee;
        uang += (tax.length === 0) ? "5802ID" : tax + "5802ID";

        let output = pecahQris[0].trim() + uang + pecahQris[1].trim();
        output += toCRC16(output);

        // Generate QR code buffer
        const qrBuffer = await QRCode.toBuffer(output, { margin: 2, scale: 10 });

        // Load QR code and template image from GitHub
        let data = dataQris(qris);
        var text = data.merchantName;
        let qr = await Jimp.read(qrBuffer);
        let templateBuffer = await downloadFile(TEMPLATE_URL);
        let image = await Jimp.read(templateBuffer);

        var w = image.bitmap.width;
        var h = image.bitmap.height;

        // Load font from GitHub
        let fontTitleUrl = `${FONT_BASE_URL}${(text.length > 18) ? 'BebasNeueSedang/BebasNeue-Regular.ttf.fnt' : 'BebasNeue/BebasNeue-Regular.ttf.fnt'}`;
        let fontNmidUrl = `${FONT_BASE_URL}${(text.length > 28) ? 'RobotoSedang/Roboto-Regular.ttf.fnt' : 'RobotoBesar/Roboto-Regular.ttf.fnt'}`;
        let fontCetakUrl = `${FONT_BASE_URL}RobotoKecil/Roboto-Regular.ttf.fnt`;

        let fontTitleBuffer = await downloadFile(fontTitleUrl);
        let fontNmidBuffer = await downloadFile(fontNmidUrl);
        let fontCetakBuffer = await downloadFile(fontCetakUrl);

        let fontTitle = await Jimp.loadFont(fontTitleBuffer);
        let fontNmid = await Jimp.loadFont(fontNmidBuffer);
        let fontCetak = await Jimp.loadFont(fontCetakBuffer);

        // Edit the template with QR code and text
        image
            .composite(qr, w / 4 - 30, h / 4 + 68)
            .print(fontTitle, w / 5 - 30, h / 5 + 68, { text: text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? -180 : -210)
            .print(fontNmid, w / 5 - 30, h / 5 + 68, { text: `NMID : ${data.nmid}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? +20 : -45)
            .print(fontNmid, w / 5 - 30, h / 5 + 68, { text: data.id, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? +110 : +90)
            .print(fontCetak, w / 20, 1205, `Dicetak oleh: ${data.nns}`);

        // Get the final image as a buffer
        const finalBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        // Send the generated image as a response
        res.set('Content-Type', 'image/jpeg');
        res.send(finalBuffer);

    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the QR code.');
    }
});

module.exports = app;
