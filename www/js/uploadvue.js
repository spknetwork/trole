export default {
    template: `
    <!--file uploader-->
    <Transition>
        <div v-if="contract.i">
            <div class="p-2 card">
                <form onsubmit="return false;">
                    <div
                        class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0 mx-2">Upload Files</h5>
                        <div class="flex-column ms-auto me-auto">
                            <input type="file" @change="uploadFile" multiple class="form-control" />
                        </div>
                        
                    </div>
                    <div class="p-5 my-4 mx-3 text-center" id="img-well"
                        @drop="dragFile($event)" @dragenter.prevent
                        @dragover.prevent>
                        Or drag the file(s) here
                    </div>
                </form>
            </div>
            <div id="listOfImgs" v-for="(file, index) in File">
                <div class="p-3 mb-3 bg-dark" style="border-radius: 10px;">
                    <div class="d-flex align-items-center flex-row pb-2 mb-2">
                        <h6 class="m-0">{{file.name}}</h6>
                        <div class="flex-grow-1 mx-5">
                            <div class="progress" role="progressbar"
                                aria-label="Upload progress" aria-valuenow="25"
                                aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar"
                                    :style="'width: ' + file.progress + '%'">
                                    {{file.progress}}%
                                </div>
                            </div>
                        </div>
                        <div class="flex-shrink" v-if="File.length">
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="file.actions.pause"
                                @click="fileRequest[index].resumeFileUpload()">Pause</button>
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="file.actions.resume"
                                @click="fileRequest[index].resumeFileUpload()">Resume</button>
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="file.actions.cancel"
                                @click="fileRequest[index].resumeFileUpload()">Cancel</button>
                        </div>
                        <div class="ms-auto">
                            <button class="btn btn-danger"
                                @click="deleteImg(index, file.name)"
                                data-toggle="tooltip" data-placement="top"
                                title="Delete Asset"><i
                                    class="fas fa-fw fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="d-flex w-100">
                        <ul class="text-start w-100">
                            <li class="">Bytes: {{file.size}}</li>
                            <li class="">CID:
                                {{FileInfo[file.name].hash}}</li>
                            <li class="">Status:
                                {{FileInfo[file.name].status}}
                            </li>
                            <li class=""><a
                                    :href="'https://ipfs.dlux.io/ipfs/' + FileInfo[file.name].hash"
                                    target="_blank">{{FileInfo[file.name].hash}}<i
                                        class="fa-solid fa-up-right-from-square fa-fw ms-1"></i></a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div v-if="File.length" class="text-center">
                <button type="button" class="btn btn-info mb-2" :disabled="ready"
                    @click="signNUpload()"><i
                        class="fa-solid fa-file-signature fa-fw me-2"></i>Sign and Upload</button>
            </div>
        </div>
    </Transition>
   `,
props: {
    user: {
        type: Object,
        default: function () {
            return {}
        }
    },
    propcontract: {
        type: Object,
        default: function () {
            return {
                id: '',
                api: ''
            }
        }
    },
},
data() {
    return {
        files: {},
        contract: {
            id: '',
            api: ''
        },
        fileRequests: {},
        FileInfo: {},
        File: [],
        ready: false,
        deletable: true,
    };
},
emits: ["tosign"],
methods: {
    uploadFile(e) {
        console.log(e)
        for (var i = 0; i < e.target.files.length; i++) {
          var reader = new FileReader();
          reader.File = e.target.files[i]
          reader.onload = (event) => {
            const fileContent = event.target.result;
            for (var i = 0; i < this.File.length; i++) {
              if (
                this.File[i].name == event.currentTarget.File.name
                && this.File[i].size == event.currentTarget.File.size
              ) {
                Hash.of(buffer.Buffer(fileContent), { unixfs: 'UnixFS' }).then((hash) => {
                  console.log(fileContent)
                  const dict = { fileContent: new TextDecoder("utf-8").decode(fileContent), hash, index: i, size: event.currentTarget.File.size, name: event.currentTarget.File.name, path: e.target.id, progress: 0, status: 'Pending Signature' }
                  this.FileInfo[dict.name] = dict
                  // this.File[i].md5 = hash;
                  // this.File[i].blob = new Blob([fileContent], event.currentTarget.File.name)
                  const file = this.File[i];
                  this.File.splice(i, 1, file);
                });
                break
              }
            }
          };
  
          reader.readAsArrayBuffer(e.target.files[i])
          var File = e.target.files[i];
          File.progress = 0;
          File.actions = {
            cancel: false,
            pause: false,
            resume: false,
          }
          // File.md5 = ""
          this.File.push(File);
        }
      },
    dragFile(e) {
        console.log(e)
        e.preventDefault();
        for (var i = 0; i < e.dataTransfer.files.length; i++) {
          var reader = new FileReader();
          reader.File = e.dataTransfer.files[i]
          reader.onload = (event) => {
            const fileContent = event.target.result;
            // for (var i = 0; i < this.File.length; i++) {
            //   if (
            //     this.File[i].name == event.currentTarget.File.name
            //     && this.File[i].size == event.currentTarget.File.size
            //   ) {
            Hash.of(buffer.Buffer(fileContent)).then(hash => {
              console.log('hereasdasd')
              const dict = { fileContent: new TextDecoder("utf-8").decode(fileContent), hash, index: this.File.length, size: event.currentTarget.File.size, name: event.currentTarget.File.name, status: 'Pending Signature' }
              this.FileInfo[dict.name] = dict
              // var File = e.dataTransfer.files[i];
              var File = event.currentTarget.File
              File.progress = 0;
              File.actions = {
                cancel: false,
                pause: false,
                resume: false,
              }
              this.File.push(File);
            })
          };
          this.ready = true
          reader.readAsArrayBuffer(e.dataTransfer.files[i]);
        }
      },
    deleteImg(index, name) {
        delete this.FileInfo[name]
        for (var item in this.FileInfo) {
          if (this.FileInfo[item].index > index) {
            this.FileInfo[item].index--
          }
        }
        this.File.splice(index, 1)
      },
      signNUpload() {
        console.log(this.contract.i)
        var header = `${this.contract.i}`
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
          this.ready = false
        })
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
          this.$emit("tosign", this.toSign);
        });
      },
      selectContract(id, broker) {  //needs PeerID of broker
        this.contract.id = id
        fetch(`https://spktest.dlux.io/user_services/${broker}`)
          .then(r => r.json())
          .then(res => {
            console.log(res)
            this.contract.api = res.services.IPFS[Object.keys(res.services.IPFS)[0]].a
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
            this.FileInfo[f.name].status = `uploading(${this.File[this.FileInfo[f.name].index].progress}%)`
            // fileObj.status = FILE_STATUS.UPLOADING;
            // fileObj.percentage = e.percentage;
            // fileObj.uploadedChunkSize = e.loaded;
  
            // updateFileElement(fileObj);
          },
          onError: (e, f) => {
            console.log('options.onError', e, f)
            // const fileObj = files.get(file);
            this.FileInfo[e.name].status = '!!ERROR!!'
            // fileObj.status = FILE_STATUS.FAILED;
            // fileObj.percentage = 100;
            this.File[this.FileInfo[e.name].index].actions.pause = false
            this.File[this.FileInfo[e.name].index].actions.resume = true
            this.File[this.FileInfo[e.name].index].actions.cancel = true
            // updateFileElement(fileObj);
          },
          onComplete: (e, f) => {
            console.log('options.onComplete', e, f)
            this.File[this.FileInfo[f.name].index].actions.pause = false
            this.File[this.FileInfo[f.name].index].actions.resume = false
            this.File[this.FileInfo[f.name].index].actions.cancel = false
            this.FileInfo[f.name].progress = 100
            this.FileInfo[f.name].status = 'done'
            var done = true
            for(var file in this.FileInfo){
              if(this.FileInfo[file].status != 'done'){
                done = false
                break;
              }
            }
            if(done){
              this.$emit('done', this.contract)
            }
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
          req.setRequestHeader('X-Contract', options.contract.i);
          req.setRequestHeader('X-Sig', options.contract.fosig);
          req.setRequestHeader('X-Account', options.contract.t);
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
              'X-Account': options.contract.t,
              'X-Contract': options.contract.i,
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
                'account': contract.t,
                'contract': contract.i,
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
        });
      },
},
computed: {
    hasFiles() {
        return Object.keys(this.files).length > 0;
    }
},
mounted() {
    this.contract = this.propcontract;
    this.selectContract(this.contract.i, this.contract.b)
},
};