const express = require('express');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const { pad, toCRC16, dataQris } = require('./lib');

const app = express();
const PORT = 3000;

app.get('/generate-qr', async (req, res) => {
    try {
        let qris = req.query.qris;
        let nominal = req.query.nominal;
        let taxtype = req.query.taxtype || 'p';
        let fee = req.query.fee || '10';

        if (!qris || !nominal) {
            return res.status(400).send('Parameter qris dan nominal diperlukan');
        }

        let qris2 = qris.slice(0, -4);
        let replaceQris = qris2.replace("010211", "010212");
        let pecahQris = replaceQris.split("5802ID");
        let uang = "54" + pad(nominal.length) + nominal;
        let tax = (taxtype === 'p') ? "55020357" + pad(fee.length) + fee : "55020256" + pad(fee.length) + fee;
        uang += (tax.length === 0) ? "5802ID" : tax + "5802ID";

        let output = pecahQris[0].trim() + uang + pecahQris[1].trim();
        output += toCRC16(output);

        // Generate QR Code
        await QRCode.toFile('tmp.png', output, { margin: 2, scale: 10 });

        // Load QR code and template
        let data = dataQris(qris);
        var text = data.merchantName;
        var qr = await Jimp.read('tmp.png');
        let image = await Jimp.read('assets/template.png');

        var w = image.bitmap.width;
        var h = image.bitmap.height;

        let fontTitle = await Jimp.loadFont((text.length > 18) ? 'assets/font/BebasNeueSedang/BebasNeue-Regular.ttf.fnt' : 'assets/font/BebasNeue/BebasNeue-Regular.ttf.fnt');
        let fontNmid = await Jimp.loadFont((text.length > 28) ? 'assets/font/RobotoSedang/Roboto-Regular.ttf.fnt' : 'assets/font/RobotoBesar/Roboto-Regular.ttf.fnt');
        let fontCetak = await Jimp.loadFont('assets/font/RobotoKecil/Roboto-Regular.ttf.fnt');

        image
            .composite(qr, w / 4 - 30, h / 4 + 68)
            .print(fontTitle, w / 5 - 30, h / 5 + 68, { text: text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? -180 : -210)
            .print(fontNmid, w / 5 - 30, h / 5 + 68, { text: `NMID : ${data.nmid}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? +20 : -45)
            .print(fontNmid, w / 5 - 30, h / 5 + 68, { text: data.id, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? +110 : +90)
            .print(fontCetak, w / 20, 1205, `Dicetak oleh: ${data.nns}`)
            .write(`output/qr_${text}.jpg`);

        fs.unlinkSync('tmp.png'); // Delete temporary QR code image

        // Send the generated image file as a response
        const filePath = path.join(__dirname, `output/qr_${text}.jpg`);
        res.download(filePath, `qr_${text}.jpg`, (err) => {
            if (err) {
                console.log(err);
            }
            // Optionally delete the image after download
            fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the QR code.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
