const express = require('express');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const { pad, toCRC16, dataQris } = require('./lib');

const app = express();

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

        // Load QR code and template image from buffer
        let data = dataQris(qris);
        var text = data.merchantName;
        let qr = await Jimp.read(qrBuffer);
        let image = await Jimp.read('assets/template.png');

        var w = image.bitmap.width;
        var h = image.bitmap.height;

        let fontTitle = await Jimp.loadFont((text.length > 18) ? 'assets/font/BebasNeueSedang/BebasNeue-Regular.ttf.fnt' : 'assets/font/BebasNeue/BebasNeue-Regular.ttf.fnt');
        let fontNmid = await Jimp.loadFont((text.length > 28) ? 'assets/font/RobotoSedang/Roboto-Regular.ttf.fnt' : 'assets/font/RobotoBesar/Roboto-Regular.ttf.fnt');
        let fontCetak = await Jimp.loadFont('assets/font/RobotoKecil/Roboto-Regular.ttf.fnt');

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
