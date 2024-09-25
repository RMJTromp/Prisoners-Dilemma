import express from 'express';
import { Server } from 'socket.io';
import * as fs from "fs";
import piston from "piston-client";

const app = express();
app.use(express.static('public'));
const server = app.listen(3000);
const io = new Server(server);

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

let state = getBlankState();
io.on("connection", async socket => {
    io.send([MESSAGE_TYPES.WELCOME, "Tic4Tac"]);

    socket.on("message", ([type, ...payload]) => {
        console.log([type, ...payload]);

        if(type === MESSAGE_TYPES.CALL) {
            const [requestId, method] = payload;
            if(method === "start") {
                if(state.running) {
                    socket.send([MESSAGE_TYPES.CALLERROR, requestId, "Game is already running"]);
                } else {
                    state.running = true;
                    socket.send([MESSAGE_TYPES.CALLRESULT, requestId, true]);

                    start();
                }
            } else if (method === "getState") {
                socket.send([MESSAGE_TYPES.CALLRESULT, requestId, state]);
            } else {
                socket.send([MESSAGE_TYPES.CALLERROR, requestId, "Unknown method"]);
            }
        }
    })
});

async function start() {
    state = getBlankState();
    state.running = true;

    // TODO initialize group names and files

    io.send([MESSAGE_TYPES.EVENT, "state", state]);

    const client = piston({ server: "https://emkc.org" });
    let team1PrevVal = "", team2PrevVal = "";
    for(let i = 0; i < 20; i++) {
        const team1Content = `opponent_previous_answer = ${team2PrevVal !== null ? "None" : `"${team2PrevVal}"`}\n` + fs.readFileSync(state.teams[0].script, "utf-8");

        const result = await client.execute("python", team1Content);
        const filteredResult = result.run.output.toLowerCase().replaceAll(/\W/g, "");
        if(filteredResult === "steal") state.teams[0].scores.push(0);
        else if(filteredResult === "nosteal") state.teams[0].scores.push(1);
        else if(filteredResult === "split") state.teams[0].scores.push(-1);
        else state.teams[0].scores.push(-2);

        const team2Content = `opponent_previous_answer = ${team1PrevVal !== null ? "None" : `"${team1PrevVal}"`}\n` + fs.readFileSync(state.teams[1].script, "utf-8");

        const result2 = await client.execute("python", team2Content);
        const filteredResult2 = result2.run.output.toLowerCase().replaceAll(/\W/g, "");
        if(filteredResult2 === "steal") state.teams[1].scores.push(0);
        else if(filteredResult2 === "nosteal") state.teams[1].scores.push(1);
        else if(filteredResult2 === "split") state.teams[1].scores.push(-1);
        else state.teams[1].scores.push(-2);

        team1PrevVal = result;
        team2PrevVal = result2;

        if(team1PrevVal === "nosteal") team1PrevVal = "no steal";
        if(team2PrevVal === "nosteal") team2PrevVal = "no steal";


        io.send([MESSAGE_TYPES.EVENT, "state", state]);
        await wait(250);
    }
}

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getBlankState() {
    return {
        running: false,
        teams: [
            {
                name: "Raygell",
                scores: [],
                script: "./scripts/strategy-1.py"
            },
            {
                name: "Joran",
                scores: [],
                script: "./scripts/strategy-2.py"
            }
        ]
    };
}