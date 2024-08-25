const express = require('express');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path')
const { pad, toCRC16, dataQris } = require('./lib');

const app = express();

app.get('/generate-qris', async (req, res) => {
    const { qris, nominal, taxtype, fee } = req.query;

    if (!qris || !nominal || !taxtype || !fee) {
        return res.status(400).send('All parameters (qris, nominal, taxtype, fee) are required');
    }

    let tax = '';
    let qris2 = qris.slice(0, -4);
    let replaceQris = qris2.replace("010211", "010212");
    let pecahQris = replaceQris.split("5802ID");
    let uang = "54" + pad(nominal.length) + nominal;
    tax = (taxtype === 'p') ? "55020357" + pad(fee.length) + fee : "55020256" + pad(fee.length) + fee;
    uang += (tax.length === 0) ? "5802ID" : tax + "5802ID";

    let output = pecahQris[0].trim() + uang + pecahQris[1].trim();
    output += toCRC16(output);

    try {
        // Generate QR code
        const qrBuffer = await QRCode.toBuffer(output, { margin: 2, scale: 10 });

        const data = dataQris(qris);
        const text = data.merchantName;
        const qr = await Jimp.read(qrBuffer);
        const image = await Jimp.read(path.join(__dirname,'assets/template.png'));

        const w = image.bitmap.width;
        const h = image.bitmap.height;
        const fonttitle = await Jimp.loadFont(path.join(__dirname, (text.length > 18) ? 'assets/font/BebasNeueSedang/BebasNeue-Regular.ttf.fnt' : 'assets/font/BebasNeue/BebasNeue-Regular.ttf.fnt'));
        const fontnmid = await Jimp.loadFont(path.join(__dirname, (text.length > 28) ? 'assets/font/RobotoSedang/Roboto-Regular.ttf.fnt' : 'assets/font/RobotoBesar/Roboto-Regular.ttf.fnt'));
        const fontcetak = await Jimp.loadFont(path.join(__dirname, 'assets/font/RobotoKecil/Roboto-Regular.ttf.fnt'));

        image
            .composite(qr, w / 4 - 30, h / 4 + 68)
            .print(fonttitle, w / 5 - 30, h / 5 + 68, { text: text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? -180 : -210)
            .print(fontnmid, w / 5 - 30, h / 5 + 68, { text: `NMID : ${data.nmid}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? +20 : -45)
            .print(fontnmid, w / 5 - 30, h / 5 + 68, { text: data.id, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, w / 1.5, (text.length > 28) ? +110 : +90)
            .print(fontcetak, w / 20, 1205, `Dicetak oleh: ${data.nns}`);

        // Convert image to buffer and return as response
        image.getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
            if (err) return res.status(500).send('An error occurred while generating the image');
            res.set('Content-Type', Jimp.MIME_JPEG);
            res.send(buffer);
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the QR code');
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

module.exports = app;
