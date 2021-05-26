async function isPermanentDisconnect (con){
    var isPermanentDisconnectFlag = false;
    var videoIsAlive = false;
    var audioIsAlive = false;

    await con.getStats(null).then(stats => {
        stats.forEach(report => {
            if(report.type === 'inbound-rtp' && (report.kind === 'audio' || report.kind  === 'video')){ //check for inbound data only
                if(report.kind  === 'audio'){
                    //Here we must compare previous data count with current
                    if(report.bytesReceived > audioReceivedByteCount){
                        // If current count is greater than previous then that means data is flowing to other peer. So this disconnected or failed ICE state is temporary
                        audioIsAlive = true;
                    } else {
                        audioIsAlive = false;
                        
                    }
                    audioReceivedByteCount = report.bytesReceived;
                }
                if(report.kind  === 'video'){
                    if(report.bytesReceived > videoReceivedBytetCount){
                        // If current count is greater than previous then that means data is flowing to other peer. So this disconnected or failed ICE state is temporary
                        videoIsAlive = true;
                    } else{
                        videoIsAlive = false;
                    }
                    videoReceivedBytetCount = report.bytesReceived;
                }
                if(audioIsAlive || videoIsAlive){ //either audio or video is being recieved.
                    isPermanentDisconnectFlag = false; //Disconnected is temp
                } else {
                    isPermanentDisconnectFlag = true;
                }
            }
        })
    });

    return isPermanentDisconnectFlag;
}

module.exports = {
  isPermanentDisconnect
}