import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { title } from 'process';

const MESSAGE_TYPE = {
  SDP: 'SDP',
  CANDIDATE: 'CANDIDATE',
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  @ViewChild('video1', { static: true }) video1: ElementRef<HTMLVideoElement>;
  @ViewChild('video2', { static: true }) video2: ElementRef<HTMLVideoElement>;
  code: any = 1;
  peerConnection: any;
  signaling: any;
  senders: any = [];
  userMediaStream: any;
  displayMediaStream: any;
  disabled: boolean = true;
  codeInput: string;
  connected: boolean = false;

  constructor(private route: ActivatedRoute) { }

  ngOnInit() {
    document.getElementById('start-button').addEventListener('click', async event => {
      this.startChat();
      this.connected = true;
    });
  }

  async startChat() {
    try {
      this.userMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      this.showChatRoom();

      this.signaling = new WebSocket('ws://localhost:9090/socket');
      this.peerConnection = this.createPeerConnection();

      this.addMessageHandler();

      this.userMediaStream.getTracks().forEach(track => this.senders.push(this.peerConnection.addTrack(track, this.userMediaStream)));
      this.video1.nativeElement.srcObject = this.userMediaStream;
    }
    catch (err) {
      console.error(err);
    }
  }

  createPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onnegotiationneeded = async () => {
      await this.createAndSendOffer();
    };

    pc.onicecandidate = (iceEvent) => {
      if (iceEvent && iceEvent.candidate) {
        this.sendMessage({
          message_type: MESSAGE_TYPE.CANDIDATE,
          content: iceEvent.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      // tslint:disable-next-line:variable-name
      const _video2 = this.video2.nativeElement;
      _video2.srcObject = event.streams[0];
    };

    return pc;
  }

  addMessageHandler() {
    this.signaling.onmessage = async message => {
      const data = JSON.parse(message.data);
      if (!data) {
        return;
      }

      const { message_type, content } = data;

      try {
        if (message_type === MESSAGE_TYPE.CANDIDATE && content) {
          await this.peerConnection.addIceCandidate(content);
        }
        else if (message_type === MESSAGE_TYPE.SDP) {
          if (content.type === 'offer') {
            await this.peerConnection.setRemoteDescription(content);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.sendMessage({
              message_type: MESSAGE_TYPE.SDP,
              content: answer,
            });
          }
          else if (content.type === 'answer') {
            await this.peerConnection.setRemoteDescription(content);
          }
          else {
            console.log('unsupported SDP type.');
          }
        }
      }
      catch (err) {
        console.error(err);
      }
    };
  }

  async createAndSendOffer() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendMessage({
      message_type: MESSAGE_TYPE.SDP,
      content: offer,
    });
  }

  sendMessage(message) {
    //const that = this;
    if (this.code) {
      const c = this.code;
      this.signaling.send(JSON.stringify({
        ...message,
        c,
      }));
    }
  }

  showChatRoom() {
    document.getElementById('start').style.display = 'none';
    document.getElementById('chat-room').style.display = 'flex';
  }

  async endCall() {
    this.userMediaStream.getTracks().forEach((track) => {
      track.stop();
    });
    this.video1.nativeElement.srcObject = null;
    this.video2.nativeElement.srcObject = null;
  }

  open(content) {
  }
}