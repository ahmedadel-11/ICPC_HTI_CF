// Import required modules
const express = require("express");
const app = express();
const router = express.Router();
const path = require('path');
const axios = require('axios');
const { JSDOM } = require("jsdom");
require('dotenv').config();

// Utility function to strip whitespace
function strip(string) {
  return string.replace(/^\s+|\s+$/g, '');
}

// Delay function for rate-limiting
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to get the DOM of a page
async function getDom(url) {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            }
        });
        const dom = new JSDOM(res.data);
        return dom.window.document;
    } catch (err) {
        console.error('Error fetching page:', err.message);
        return null;
    }
}

// Function to fetch contest standings and process them
const getAc = async (url) => {
    try {
        const dom = await getDom(url);
        if (!dom) return { status: 'FAILED', result: 'Error fetching page' };

        let standing = dom.querySelector('.standings');
        if (!standing) return { status: 'FAILED', result: 'No standings found' };

        let problemsA = standing.rows[0].querySelectorAll('a');
        let problems = [];
        for (let problem of problemsA) {
            problems.push({
                'name': problem.title,
                'link': 'https://codeforces.com' + problem.href
            });
        }

        let sheetNameA = dom.querySelector(".contest-name").querySelector('a');
        let contest = {
            'name': strip(sheetNameA.textContent),
            'link': 'https://codeforces.com' + sheetNameA.href,
            'problems': problems
        };

        let data = {};
        for (let i = 1; i < standing.rows.length - 1; i++) {
            let team = 'Not a team', contestants = [];
            let tr = standing.rows[i].querySelectorAll('td'), isTeam = true;
            try {
                trA = tr[1].querySelector('span').querySelectorAll('a');
                if (!trA.length) isTeam = false;
            } catch {
                isTeam = false;
            }

            if (isTeam && trA[0].href.includes('team')) {
                team = trA[0]['title'];
                for (let k = 1; k < trA.length; k++) {
                    tmp = (trA[k].title.split(' '));
                    contestants.push(tmp[tmp.length - 1]);
                }
            } else {
                tmp = (tr[1].querySelector('a').title.split(' '));
                contestants.push(tmp[tmp.length - 1]);
            }

            let tds = standing.rows[i].querySelectorAll('td');
            for (let i = 4; i < tds.length; i++) {
                let txt = strip(tds[i].querySelector('span').textContent) || '-';
                if (txt[0] == '-') continue;
                for (let j = 0; j < contestants.length; j++) {
                    if (!(contestants[j] in data)) {
                        data[contestants[j]] = [];
                    }
                    let pNum = problems[i - 4].name.split(' - ')[0];
                    if (!data[contestants[j]].includes(pNum))
                        data[contestants[j]].push(pNum);
                }
            }
        }

        let keys = Object.keys(data);
        let promises = keys.map(async (key) => {
            data[key] = {
                ac: data[key].join('-')
            };
        });
        await Promise.all(promises);

        return {
            'status': 'OK',
            'result': {
                'contest': contest,
                'contestants': data
            },
        }
    } catch (err) {
        console.error('Error processing data:', err.message);
        return {
            'status': 'FAILED',
            'result': 'There is something wrong :(',
            'err': err.message
        };
    }
}

// Route to fetch standings for each contestant
router.get('/g/:groupId/c/:contestId/p/:page', async (req, res) => {
    let { groupId, contestId, page } = req.params;
    let url = `https://codeforces.com/group/${groupId}/contest/${contestId}/standings/page/${page}?showUnofficial=true`;

    console.log('Fetching data from URL:', url);

    await delay(1000);  // Delay for 1 second between requests to avoid rate limiting

    let ret = await getAc(url);
    res.status(200).json(ret);  // Send the result in JSON format
});

// Route to fetch standings with a specific list
router.get('/g/:groupId/c/:contestId/p/:page/l/:listId', async (req, res) => {
    let { groupId, contestId, listId, page } = req.params;
    let url = `https://codeforces.com/group/${groupId}/contest/${contestId}/standings/page/${page}?list=${listId}&showUnofficial=true`;

    console.log('Fetching data from URL:', url);

    await delay(1000);  // Delay for 1 second between requests to avoid rate limiting

    let ret = await getAc(url);
    res.status(200).json(ret);  // Send the result in JSON format
});

// Serve static files (like your 'error.html')
app.use(express.static(__dirname));

// Fallback route for undefined pages
app.get('*', (req, res) => {
    console.log('Invalid route accessed:', req.originalUrl);
    res.sendFile(path.join(__dirname, 'error.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server is listening on port " + PORT);
});
