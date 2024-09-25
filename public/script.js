import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

console.log("Connecting to server...");
const url = new URL(window.location.href);
url.protocol = "ws:";
const socket = io(url);

const MESSAGE_TYPES = {
    WELCOME: 0,
    PREFIX: 1,
    CALL: 2,
    CALLRESULT: 3,
    CALLERROR: 4,
    SUBSCRIBE: 5,
    UNSUBSCRIBE: 6,
    PUBLISH: 7,
    EVENT: 8
};

let state = undefined;
const activeRequests = new Map();
socket.on("message", ([type, ...payload]) => {
    console.log([type, ...payload]);
    if(type === MESSAGE_TYPES.WELCOME) {
        console.log("Connected to server");

        callMethod("getState").then(newState => {
            state = newState;
            updateUI();
        })
    } else if(type === MESSAGE_TYPES.CALLRESULT || type === MESSAGE_TYPES.CALLERROR) {
        const [requestId, result] = payload;
        const success = type === MESSAGE_TYPES.CALLRESULT;
        const [resolve, reject] = activeRequests.get(requestId);
        if(success) resolve(result);
        else reject(result);
    } else if(type === MESSAGE_TYPES.EVENT) {
        const [eventName, data] = payload;
        if(eventName === "state") {
            state = data;
            updateUI();
        }
    }
})

document.getElementById("start").onclick = () => {
    callMethod("start").then(() => {
        console.log("Game started");
    }).catch(console.error);
}

const $ = q => document.querySelector(q);

function updateUI() {
    if(!state) return;
    $("#legend").hidden = !state.running;
    $("#scoreboard").hidden = !state.running;
    $("#start").hidden = state.running;

    $("#t1name").textContent = state.teams[0].name ?? "Team 1";
    $("#t2name").textContent = state.teams[1].name ?? "Team 2";

    const team1Orbs = [...$("#team1-orbs").querySelectorAll(".orb")];
    const team2Orbs = [...$("#team2-orbs").querySelectorAll(".orb")];

    function applyScore(scores, orbs) {
        for (let i = 0; i < 20; i++) {
            let score = scores[i] ?? undefined;
            if(score !== undefined) {
                if(score === 1) orbs[i].style.background = "green";
                else if(score === 0) orbs[i].style.background = "red";
                else if(score === -1) orbs[i].style.background = "yellow";
            } else {
                orbs[i].style = "";
            }
        }
    }

    applyScore(state.teams[0].scores ?? [], team1Orbs)
    applyScore(state.teams[1].scores ?? [], team2Orbs)

    const team1Total = calculateScore(state.teams[0].scores ?? [], state.teams[1].scores ?? []);
    const team2Total = calculateScore(state.teams[1].scores ?? [], state.teams[0].scores ?? []);

    $("#t1name").parentElement.querySelector(".team-orb-circle").textContent = team1Total;
    $("#t2name").parentElement.querySelector(".team-orb-circle").textContent = team2Total;

    function calculateScore(allyScores, enemyScores) {
        let total = 0;
        for (let i = 0; i < Math.max(allyScores.length, enemyScores.length); i++) {
            const allyScore = allyScores[i] ?? 0;
            const enemyScore = enemyScores[i] ?? 0;

            total += calculatePoints(allyScore, enemyScore);
        }
        return total;
    }

    function calculatePoints(ally, enemy) {
        if(ally === 1) {
            if(enemy === 1) return 3;
            else if(enemy === 0) return 0;
            else if(enemy === -1) return 1;
        } else if(ally === 0) {
            if(enemy === 1) return 5;
            else if(enemy === 0) return 0;
            else if(enemy === -1) return 5;
        } else if(ally === -1) {
            if(enemy === 1) return 1;
            else if(enemy === 0) return 0;
            else if(enemy === -1) return 1;
        }
        return 0;
    }
}

function callMethod(name, ...params) {
    const requestId = Math.random().toString(36).substring(7);
    socket.send([MESSAGE_TYPES.CALL, requestId, name, ...params]);
    return new Promise((resolve, reject) => {
        activeRequests.set(requestId, [(result) => {
            activeRequests.delete(requestId);
            resolve(result);
        }, (result) => {
            activeRequests.delete(requestId);
            reject(result);
        }]);
    })
}