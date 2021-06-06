// https://stackoverflow.com/questions/63582725/webrtc-differentiate-between-temporary-disconnect-or-failure-and-permanant
let con;

const customdelay = ms => new Promise(res => setTimeout(res, ms));

async function checkStatePermanent(_con, iceState) {
  con = _con;
  videoReceivedBytetCount = 0;
  audioReceivedByteCount = 0;

  let firstFlag = await isPermanentDisconnect();

  await customdelay(6000);

  let secondFlag = await isPermanentDisconnect(); //Call this func again after 6 seconds to check whether data is still coming in.

  if (secondFlag) {
    //If permanent disconnect then we hangup i.e no audio/video is fllowing
    if (iceState == "disconnected") {
      console.log('permanent disconnect')
      
    // TEMP: shouldn't restart ice here, but need to for a test
    //If temp failure then restart ice i.e audio/video is still flowing
    if (iceState == "failed") {
      con.restartIce();
    }
    
      
      return true;
      // hangUpCall(); //Hangup instead of closevideo() because we want to record call end in db
    }
  }
  if (!secondFlag) {
    console.log('temporary failure to connect')
    
    //If temp failure then restart ice i.e audio/video is still flowing
    if (iceState == "failed") {
      con.restartIce();
    }
    
    return false;
  }
}

var videoReceivedBytetCount = 0;
var audioReceivedByteCount = 0;

async function isPermanentDisconnect() {
  var isPermanentDisconnectFlag = false;
  var videoIsAlive = false;
  var audioIsAlive = false;

  await con.getStats(null).then(stats => {
    stats.forEach(report => {
      if (
        report.type === "inbound-rtp" &&
        (report.kind === "audio" || report.kind === "video")
      ) {
        //check for inbound data only
        if (report.kind === "audio") {
          //Here we must compare previous data count with current
          if (report.bytesReceived > audioReceivedByteCount) {
            // If current count is greater than previous then that means data is flowing to other peer. So this disconnected or failed ICE state is temporary
            audioIsAlive = true;
          } else {
            audioIsAlive = false;
          }
          audioReceivedByteCount = report.bytesReceived;
        }
        if (report.kind === "video") {
          if (report.bytesReceived > videoReceivedBytetCount) {
            // If current count is greater than previous then that means data is flowing to other peer. So this disconnected or failed ICE state is temporary
            videoIsAlive = true;
          } else {
            videoIsAlive = false;
          }
          videoReceivedBytetCount = report.bytesReceived;
        }
        if (audioIsAlive || videoIsAlive) {
          //either audio or video is being recieved.
          isPermanentDisconnectFlag = false; //Disconnected is temp
        } else {
          isPermanentDisconnectFlag = true;
        }
      }
    });
  });

  return isPermanentDisconnectFlag;
}

module.exports = {
  checkStatePermanent,
  isPermanentDisconnect
};
