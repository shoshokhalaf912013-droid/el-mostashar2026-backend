import { Room } from "livekit-client";

let room;

export async function startLive(username, roomName) {

  const res = await fetch(
    `http://localhost:5000/api/live/token?room=${roomName}&username=${username}`
  );

  const data = await res.json();

  const token = data.token;
  const url = data.url;

  room = new Room();

  await room.connect(url, token);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  stream.getTracks().forEach(track => {
    room.localParticipant.publishTrack(track);
  });

  console.log("✅ Live connected");

  return room;
}