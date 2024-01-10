import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'
import Navue from "/js/navue.js";
import ContractVue from "/js/contractvue.js";
import SpkVue from "/js/spkvue.js";
createApp({
  directives: {
  },
  data() {
    return {
      account: '',
      toSign: {},
      stats: {},
      contracts: [],
      showDetails: true,
      showContracts: true,
      showNewContracts: true,
      me: true,
      newContracts: [],
      feed: {},
      lastFeed: 0,
      spkapi: "https://spktest.dlux.io",
    };
  },
  components: {
    "nav-vue": Navue,
    "contract-vue": ContractVue,
    "spk-vue": SpkVue,
  },
  methods: {
    removeOp(txid) {
      if (this.toSign.txid == txid) {
        this.toSign = {};
      }
    },
    log(msg) {
      console.log(msg);
    },
    getFeed(since = 0) {
      console.log({ since })
      fetch(`${this.spkapi}/feed`).then(res => res.json()).then(r => {
        var feedKeys = Object.keys(r.feed)
        for (let i = 0; i < feedKeys.length; i++) {
          const key = feedKeys[i].split(":")[0]
          if (key > since) {
            this.feed[feedKeys[i]] = r.feed[feedKeys[i]]
            if(r.feed[feedKeys[i]].indexOf(" bundled") > -1){
              this.getNewContract(r.feed[feedKeys[i]].split(" bundled")[0])
            }
          }
          if (i == feedKeys.length - 1) {
            this.lastFeed = parseInt(key)
          }
        }
      })
    },
    getState() {
      fetch('/upload-stats').then(res => res.json()).then(state => {
        this.stats = state
        if(!this.account)this.account = state.node
      })
    },
    getContracts() {
      fetch('/contracts').then(res => res.json()).then(r => {
        this.contracts = r.contracts
        //update contract data
        for (let i = 0; i < this.contracts.length; i++) {
          const contract = this.contracts[i];
          this.getContract(contract, i)
        }
      })
    },
    getContract(contract, i = -1) {
      console.log(`${this.spkapi}/api/fileContract/${contract.i}`)
      fetch(`${this.spkapi}/api/fileContract/${contract.i}`).then(res => res.json()).then(r => {
        if(i > -1)this.contracts.splice(i, 1, r.result)
      })
    },
    getNewContract(contract, i = -1) {
      console.log('Feed Contract',`${this.spkapi}/api/fileContract/${contract}`)
      fetch(`${this.spkapi}/api/fileContract/${contract}`).then(res => res.json()).then(r => {
        if(i > -1)this.newContracts.splice(i, 1, r.result)
        else {
          this.newContracts.push(r.result)
          this.newContracts = [...new Set(this.newContracts)]
        }

      })
    },
    get_dynamic_global_properties(key){
      fetch(this.watchDog[key].api, {
        body: `{"jsonrpc":"2.0", "method":"condenser_api.get_dynamic_global_properties", "params":[], "id":1}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      })
        .then((r) => r.json())
        .then((r) => {
          this.watchDog[key].data.gdp = r.result;
        });
    },
    signText(challenge) {
      return new Promise((res, rej) => {
        this.toSign = {
          type: "sign_headers",
          challenge,
          key: "posting",
          ops: [],
          callbacks: [res, rej],
          txid: "Sign Auth Headers",
        };
      });
    },
    selectContract(id, broker) {  //needs PeerID of broker
      this.contract.id = id
      fetch(`${sapi}/user_services/${broker}`)
        .then(r => r.json())
        .then(res => {
          console.log(res)
          this.contract.api = res.services.IPFS[Object.keys(res.services.IPFS)[0]].a
        })
    },
    signNUpload() {
      console.log(this.contract.id)
      var header = `${this.contract.id}`
      var body = ""
      var names = Object.keys(this.FileInfo)
      var cids = []
      for (var i = 0; i < names.length; i++) {
        body += `,${this.FileInfo[names[i]].hash}`
        cids.push(this.FileInfo[names[i]].hash)
      }
      this.contract.files = body
      this.signText(header + body).then(res => {
        console.log({ res })
        this.contract.fosig = res.split(":")[3]
        this.upload(cids, this.contract)
      })
    },
    upload(cids = ['QmYJ2QP58rXFLGDUnBzfPSybDy3BnKNsDXh6swQyH7qim3'], contract ) { // = { api: 'https://ipfs.dlux.io', id: '1668913215284', sigs: {}, s: 10485760, t: 0 }) {
      var files = []
      for (var name in this.FileInfo) {
        for (var i = 0; i < cids.length; i++) {
          if (this.FileInfo[name].hash == cids[i]) {
            this.File[this.FileInfo[name].index].cid = cids[i]
            files.push(this.File[this.FileInfo[name].index])
            break;
          }
        }
      }
      console.log({ cids }, files)
      const ENDPOINTS = {
        UPLOAD: `${this.contract.api}/upload`,
        UPLOAD_STATUS: `${this.contract.api}/upload-check`,
        UPLOAD_REQUEST: `${this.contract.api}/upload-authorize`
      };
      const defaultOptions = {
        url: ENDPOINTS.UPLOAD,
        startingByte: 0,
        contract: contract,
        cid: null,
        cids: `${cids.join(',')}`,
        onAbort: (e, f) => {
          console.log('options.onAbort')
          // const fileObj = files.get(file);
          this.File = []
          this.FileInfo = {}
          this.fileRequests = {}
          // updateFileElement(fileObj);
        },
        onProgress: (e, f) => {
          console.log('options.onProgress', e, f, this.FileInfo, this.File, this.File[this.FileInfo[f.name].index])
          this.File[this.FileInfo[f.name].index].actions.pause = true
          this.File[this.FileInfo[f.name].index].actions.resume = false
          this.File[this.FileInfo[f.name].index].actions.cancel = true
          this.File[this.FileInfo[f.name].index].progress = e.loaded / e.total * 100
          // const fileObj = files.get(file);
          this.FileInfo[f.name].status = 'uploading'
          // fileObj.status = FILE_STATUS.UPLOADING;
          // fileObj.percentage = e.percentage;
          // fileObj.uploadedChunkSize = e.loaded;

          // updateFileElement(fileObj);
        },
        onError: (e, f) => {
          console.log('options.onError', e, f)
          // const fileObj = files.get(file);
          this.FileInfo[f.name].status = '!!ERROR!!'
          // fileObj.status = FILE_STATUS.FAILED;
          // fileObj.percentage = 100;
          this.File[this.FileInfo[f.name].index].actions.pause = false
          this.File[this.FileInfo[f.name].index].actions.resume = true
          this.File[this.FileInfo[f.name].index].actions.cancel = true
          // updateFileElement(fileObj);
        },
        onComplete: (e, f) => {
          console.log('options.onComplete', e, f)
          this.File[this.FileInfo[f.name].index].actions.pause = false
          this.File[this.FileInfo[f.name].index].actions.resume = false
          this.File[this.FileInfo[f.name].index].actions.cancel = false
          this.FileInfo[f.name].progress = 1
          this.FileInfo[f.name].status = 'done'

        }
      };
      const uploadFileChunks = (file, options) => {
        const formData = new FormData();
        const req = new XMLHttpRequest();
        const chunk = file.slice(options.startingByte);

        formData.append('chunk', chunk);
        console.log(options)
        req.open('POST', options.url, true);
        req.setRequestHeader(
          'Content-Range', `bytes=${options.startingByte}-${options.startingByte + chunk.size}/${file.size}`
        );
        req.setRequestHeader('X-Cid', options.cid);
        req.setRequestHeader('X-Contract', options.contract.id);
        req.setRequestHeader('X-Sig', options.contract.fosig);
        req.setRequestHeader('X-Account', this.account);
        req.setRequestHeader('X-Files', options.cids);


        req.onload = (e) => {
          if (req.status === 200) {
            options.onComplete(e, file);
          } else {
            options.onError(e, file);
          }
        };

        req.upload.onprogress = (e) => {
          const loaded = options.startingByte + e.loaded;
          options.onProgress({
            ...e,
            loaded,
            total: file.size,
            percentage: loaded / file.size * 100
          }, file);
        };

        req.ontimeout = (e) => options.onError(e, file);

        req.onabort = (e) => options.onAbort(e, file);

        req.onerror = (e) => options.onError(e, file);

        this.fileRequests[options.cid].request = req;

        req.send(formData);
      };
      const uploadFile = (file, options, cid) => {
        console.log('Uploading', cid, options, file)
        return fetch(ENDPOINTS.UPLOAD_REQUEST, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Sig': options.contract.fosig,
            'X-Account': this.account,
            'X-Contract': options.contract.id,
            'X-Cid': cid,
            'X-Files': options.contract.files,
            'X-Chain': 'HIVE'
          }
        })
          .then(res => res.json())
          .then(res => {
            console.log('Chunking', options, file)
            options = { ...options, ...res };
            options.cid = cid
            this.fileRequests[cid] = { request: null, options }
            uploadFileChunks(file, options);
          })
          .catch(e => {
            console.log(e)
            options.onError({ ...e, file })
          })
      };
      const abortFileUpload = (file) => {
        const fileReq = fileRequests.get(file);

        if (fileReq && fileReq.request) {
          fileReq.request.abort();
          return true;
        }

        return false;
      };
      const retryFileUpload = (file) => {
        const fileReq = fileRequests.get(file);

        if (fileReq) {
          // try to get the status just in case it failed mid upload
          return fetch(
            `${ENDPOINTS.UPLOAD_STATUS}?fileName=${file.name}&fileId=${fileReq.options.fileId}`)
            .then(res => res.json())
            .then(res => {
              // if uploaded we continue
              uploadFileChunks(
                file,
                {
                  ...fileReq.options,
                  startingByte: Number(res.totalChunkUploaded)
                }
              );
            })
            .catch(() => {
              // if never uploaded we start
              uploadFileChunks(file, fileReq.options)
            })
        }
      };
      const clearFileUpload = (file) => {
        const fileReq = fileRequests.get(file);

        if (fileReq) {
          abortFileUpload(file)
          fileRequests.delete(file);

          return true;
        }

        return false;
      };
      const resumeFileUpload = (file) => {
        const fileReq = this.fileRequests[cid];

        if (fileReq) {
          return fetch(
            `${ENDPOINTS.UPLOAD_STATUS}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'sig': contract.fosig,
              'account': this.account,
              'contract': contract.id,
              'cid': cid
            }
          })
            .then(res => res.json())
            .then(res => {
              uploadFileChunks(
                file,
                {
                  ...fileReq.options,
                  startingByte: Number(res.totalChunkUploaded)
                }
              );
            })
            .catch(e => {
              fileReq.options.onError({ ...e, file })
            })
        }
      };
      [...files]
        .forEach(file => {
          let options = defaultOptions
          options.cid = file.cid
          uploadFile(file, options, file.cid)
        });
      // return (files, options = defaultOptions) => {
      //   [...files]
      //     .forEach(file => {
      //       console.log(file)
      //       options.cid = file.cid
      //       uploadFile(file, options)
      //     });

      //   return {
      //     abortFileUpload,
      //     retryFileUpload,
      //     clearFileUpload,
      //     resumeFileUpload
      //   };
      // }
    },
    replace(string, char = ':') {
      return string.replaceAll(char, '_')
    },
    addToPost(contract){

    },
    appendFile(file, id) {
      if (this.files[file]) delete this.files[file]
      else this.files[file] = id
    },
    uploadAndTrack(name, contract) {
      this.signText().then((headers) => {
        let uploader = null;
        const setFileElement = (file) => {
          // create file element here
        }
        const onProgress = (e, file) => { };
        const onError = (e, file) => { };
        const onAbort = (e, file) => { };
        const onComplete = (e, file) => { };
        return (uploadedFiles) => {
          [...uploadedFiles].forEach(setFileElement);

          //append progress box
          uploader = uploadFiles(uploadedFiles, {
            onProgress,
            onError,
            onAbort,
            onComplete
          });
        }
        // var formdata = new FormData();
        // console.log(this.FileInfo[name].path)
        // console.log(document.getElementById(this.FileInfo[name].path))
        // formdata.append('file', document.getElementById(this.FileInfo[name].path).files[0]);
        // formdata.append(
        //   "path",
        //   `/${headers.split(":")[0]}/${headers.split(":")[1]}.${this.account}`
        // );
        // for (const value of formdata.values()) {
        //   console.log(value);
        // }
        // var myHeaders = new Headers()
        // myHeaders.append("Content-Type", "multipart/form-data")
        // var requestOptions = {
        //   method: "POST",
        //   body: formdata,
        //   headers: myHeaders,
        //   connection: 'keep-alive', 
        //   mode: 'cors',
        //   redirect: "follow",
        //   //credentials: 'include',
        // };
        // fetch(
        //   `https://ipfs.dlux.io/api/v0/add?stream-channels=true&pin=false&wrap-with-directory=false&progress=true&account=${this.account}&cid=${headers.split(":")[0]}&sig=${headers.split(":")[1]}`,
        //   //`https://ipfs.dlux.io/api/v0/add?stream-channels=true&pin=false&wrap-with-directory=false&progress=true&account=${this.account}&cid=${headers.split(":")[0]}&sig=${headers.split(":")[1]}`,
        //   requestOptions
        // )
        //   .then((response) => {
        //     response.text()
        //     console.log(response)
        //   })
        //   .then((result) => console.log(result))
        //   .catch((error) => console.log("error", error));
      });
    },
  },
  mounted() {
    this.getState()
    this.getContracts()
    this.getFeed()
    setInterval(() => {
      this.getState()
      this.getFeed(this.lastFeed)
    }, 60000)
  },
  unmounted() {
  },
  watch: {
  },
  computed: {
  },
}).mount('#app')
