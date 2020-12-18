const puppeteer = require('puppeteer')
const md5 = require('md5')
const express = require('express')
const app = express()
let browser

function checkLoaded() {
    return Promise.resolve(window.loaded === true)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function generateTmpName() {
    return md5(new Date().getTime() + '' + Math.random()) + '.pdf'
}

async function loopCheck(checkFn, timeoutMs = 0, intervalMs = 100) {
    return new Promise(async (resolve, reject) => {
        let success = false
        const timeout = timeoutMs > 0 ? setTimeout(function () {
            reject("检查超时")
        }, timeoutMs) : null

        while (success !== true) {
            success = await checkFn()
            if (!success) {
                await sleep(intervalMs)
            } else {
                resolve()
            }
        }
        success && timeout && clearTimeout(timeout)
    })
}

async function generatorPdf() {
    const page = await browser.newPage()
    try {
        await page.goto('http://10.83.1.43:8002/', {waitUntil: 'networkidle2'})
        await page.evaluate(() => {
            window.loaded = true
        })

        try {
            await loopCheck(() => {
                return page.evaluate(checkLoaded)
            }, 10 * 1000, 500)
        } catch (e) {
            throw new Error('加载超时')
        }

        await page.pdf({path: 'pdf/' + generateTmpName(), format: 'A4'})
    } finally {
        await page.close()
    }
}

process.addListener("unhandledRejection", async (e) => {
    console.error(e)
    await browser.close()
    process.exit(0)
})

let pdfCount = 0
app.get('/', async function (req, res) {
    try {
        await loopCheck(() => {
            return Promise.resolve(pdfCount < 5)
        }, 0, 100)
        pdfCount++
        await generatorPdf()
        pdfCount--
        res.send({success: true})
    } catch (e) {
        console.error(e)
        res.send({success: false})
    }
})

puppeteer.launch({
    headless: true,
    args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--single-process'
    ]
}).then((val) => {
    browser = val
    app.listen(3000)
})
