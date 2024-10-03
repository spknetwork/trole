import ChoicesVue from '/js/choices-vue.js';

export default {
  components: {
    "choices-vue": ChoicesVue
  },
  template: `
 <!--file uploader-->
    <Transition>
       <div v-if="contract.i">
        <div>
            <form onsubmit="return false;">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="ms-auto me-auto my-3">
                        <label for="formFile" class="btn btn-lg btn-light"><i
                                class="fa-solid fa-file-circle-plus fa-fw me-2"></i>Select Files</label>
                        <input class="d-none" id="formFile" type="file" multiple @change="uploadFile">
                    </div>
                </div>
                <div class="pb-2">
                    <div class="mx-lg-5 py-5 text-center lead rounded"
                        style="border-width: 2px; border-style: dashed; background-color:rgba(0,0,0,0.3);" id="img-well"
                        @drop="dragFile($event)" @dragenter.prevent @dragover.prevent>
                        Or drag file(s) here
                    </div>
                </div>
            </form>
        </div>



        <div v-if="File.length" class="mx-lg-5 rounded" style="background-color:rgba(0,0,0,0.3)">

            <div class="d-flex mx-1">
                <div class="mx-auto ms-md-1 mt-2 lead fs-2">{{ fileCount }} | {{fancyBytes(totalSize)}}</div>
            </div>

            <div id="listOfImgs" v-if="!encryption.encrypted" v-for="(file, key,index) in FileInfo"
                class="rounded px-1 p-lg-2">



                <div class="my-2 card " v-if="!FileInfo[file.name].is_thumb">

                    <div class="d-flex flex-wrap align-items-center px-2 py-1">
                        <div>
                            <div class="fs-4 fw-light m-0 text-break"><span
                                    class="px-2 py-1 me-2 border border-light text-white rounded-pill"><i
                                        class="fa-solid fa-lock-open fa-fw"></i></span>{{file.name}}</div>
                        </div>

                        <div class="flex-grow-1 mx-5" >
                        {{File[FileInfo[file.name].index].progress}}
                         <!--v-if="File[FileInfo[file.name].index].actions.cancel"-->
                            <div class="progress" role="progressbar" aria-label="Upload progress" aria-valuenow="25"
                                aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar"
                                    :style="'width: ' + File[FileInfo[file.name].index].progress + '%'">
                                    {{File[FileInfo[file.name].index].progress}}%
                                </div>
                            </div>
                        </div>
                        <div class="flex-shrink" v-if="File.length">
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="File[FileInfo[file.name].index].actions.pause"
                                @click="fileRequest[FileInfo[file.name].index].resumeFileUpload()">Pause</button>
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="File[FileInfo[file.name].index].actions.resume"
                                @click="fileRequest[FileInfo[file.name].index].resumeFileUpload()">Resume</button>
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="File[FileInfo[file.name].index].actions.cancel"
                                @click="fileRequest[FileInfo[file.name].index].resumeFileUpload()">Cancel</button>
                        </div>
                        <div class="ms-auto my-1">
                            <button class="btn btn-danger" @click="deleteImg(FileInfo[file.name].index, file.name)"
                                data-toggle="tooltip" data-placement="top" title="Delete Asset"><i
                                    class="fas fa-fw fa-trash-alt"></i></button>
                        </div>
                    </div>

                    <div class="d-flex flex-wrap align-items-center  px-2 py-2 mb-1 rounded-bottom">
                        <div class="flex-grow-1">

                            <div class="d-flex flex-wrap justify-content-around">

                                <div class="d-flex flex-column justify-content-center py-2 rounded" style="background-color:rgba(0,0,0,0.3); min-width:350px;">

                                    <div class="d-flex align-items-center px-2 py-1" v-if="FileInfo['thumb' + file.name]" >
                                        <div class="me-auto fs-5 text-wrap">
                                          Automatic Thumbnail
                                          <span class="small d-none">({{fancyBytes(FileInfo['thumb' + file.name].size)}})</span>
                                        </div>
                                        <div class="form-check form-switch">
                                            <input class="form-check-input fs-4" @click="resetThumb(file.name)" type="checkbox"
                                                role="switch" :id="'includeThumb' + file.name" :checked="FileInfo['thumb' + file.name].use_thumb">
                                            <label class="form-check-label" :for="'includeThumb' + file.name"></label>
                                        </div>
                                    </div>
                                    
                                    <div class="mx-auto my-auto"
                                        v-if="FileInfo['thumb' + file.name] && FileInfo['thumb' + file.name].use_thumb">
                                        <img :src="FileInfo['thumb' + file.name].fileContent"
                                            class="img-thumbnail"></img>
                                    </div>
                                    <div class="img-thumbnail mx-auto my-auto"
                                        v-if="!FileInfo['thumb' + file.name] || !FileInfo['thumb' + file.name].use_thumb">
                                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg"
                                            xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                            viewBox="0 0 800 800"
                                            style="enable-background:new 0 0 800 800; background-color: #fff; width: 128px; border-radius: .25em;"
                                            xml:space="preserve">

                                            <g>
                                                <path class="st0" d="M650,210H500c-5.5,0-10-4.5-10-10V50c0-5.5,4.5-10,10-10s10,4.5,10,10v140h140c5.5,0,10,4.5,10,10
                                                  S655.5,210,650,210z" />
                                                <path class="st0" d="M650,309.7c-5.5,0-10-4.5-10-10v-95.5L495.9,60H200c-22.1,0-40,17.9-40,40v196.3c0,5.5-4.5,10-10,10
                                                  s-10-4.5-10-10V100c0-33.1,26.9-60,60-60h300c2.7,0,5.2,1,7.1,2.9l150,150c1.9,1.9,2.9,4.4,2.9,7.1v99.7
                                                  C660,305.2,655.5,309.7,650,309.7z" />
                                                <path class="st0"
                                                    d="M600,760H200c-33.1,0-60-26.9-60-60V550c0-5.5,4.5-10,10-10s10,4.5,10,10v150c0,22.1,17.9,40,40,40h400
                                                  c22.1,0,40-17.9,40-40V550c0-5.5,4.5-10,10-10s10,4.5,10,10v150C660,733.1,633.1,760,600,760z" />
                                                <path class="st0"
                                                    d="M550,560H250c-5.5,0-10-4.5-10-10s4.5-10,10-10h300c5.5,0,10,4.5,10,10S555.5,560,550,560z" />
                                                <path class="st0"
                                                    d="M400,660H250c-5.5,0-10-4.5-10-10s4.5-10,10-10h150c5.5,0,10,4.5,10,10S405.5,660,400,660z" />
                                                <path class="st0"
                                                    d="M650,560H150c-33.1,0-60-26.9-60-60l0,0V346.3c0-33.1,26.9-60,60-60l0,0h0.4l500,3.3
                                                  c32.9,0.3,59.5,27.1,59.6,60V500C710,533.1,683.2,560,650,560C650,560,650,560,650,560z M150,306.3c-22.1,0-40,17.9-40,40V500
                                                  c0,22.1,17.9,40,40,40h500c22.1,0,40-17.9,40-40V349.7c-0.1-22-17.8-39.8-39.8-40l-500-3.3H150z" />
                                                <text transform="matrix(1 0 0 1 233.3494 471.9725)" class="st1 st2"
                                                    style="text-transform: uppercase; font-size: 149px;">{{FileInfo[file.name].meta.ext}}</text>
                                            </g>
                                        </svg>
                                    </div>

                                   
                                    <span class="fs-4 mx-auto"> {{ FileInfo['thumb' + file.name] && FileInfo['thumb' + file.name].use_thumb ? fancyBytes(FileInfo['thumb' + file.name].size + FileInfo[file.name].size) : fancyBytes(FileInfo[file.name].size)}} </span>

                                    <!-- link -->
                                    <div class="mx-2">
                                        <a :href="'https://ipfs.dlux.io/ipfs/' + FileInfo[file.name].hash"
                                            target="_blank" class="w-100 btn btn-sm btn-primary mb-1 mx-auto"><span
                                                class="d-flex align-items-center">URL<i
                                                    class="ms-auto fa-solid fa-fw fa-up-right-from-square"></i></span></a>
                                    </div>
                                </div>

                                <div class="d-flex flex-column">

                                    <div class="mb-1">
                                        <label class="mb-1">File Name</label>
                                        <div class="input-group">
                                            <input autocapitalize="off" placeholder="File Name"
                                                pattern="[a-zA-Z0-9]{3,25}" class="form-control bg-dark border-0 text-info"
                                                v-model="FileInfo[file.name].meta.name">
                                            <span class="input-group-text">.</span>
                                            <input autocapitalize="off" placeholder="File Type"
                                                pattern="[a-zA-Z0-9]{1,4}" class="form-control bg-dark border-0 text-info"
                                                v-model="FileInfo[file.name].meta.ext">
                                        </div>
                                    </div>
                                    <div class="mb-1">
                                        <label class="mb-1">Thumbnail</label>
                                        <div v-if="FileInfo['thumb' + file.name]"
                                            class="position-relative has-validation">
                                            <input autocapitalize="off"
                                                :disabled="FileInfo['thumb' + file.name].use_thumb"
                                                placeholder="https://your-thumbnail-image.png"
                                                pattern="https:\/\/[a-z0-9.-\/]+|Qm[a-zA-Z0-9]+"
                                                class="form-control disabled bg-dark border-0" v-model="FileInfo[file.name].meta.thumb">
                                        </div>
                                        <div v-if="!FileInfo['thumb' + file.name]"
                                            class="position-relative has-validation">
                                            <input autocapitalize="off" placeholder="https://your-thumbnail-image.png"
                                                pattern="https:\/\/[a-z0-9.-\/]+|Qm[a-zA-Z0-9]+"
                                                class="form-control disabled" v-model="FileInfo[file.name].meta.thumb">
                                        </div>
                                    </div>

                                    <!-- choices-js-->
                                    <div class="mb-1">
                                        <label class="mb-1">Tags</label>
                                        <choices-vue :ref="file.name +'select-tag'" prop_type="tags"
                                            :reference="file.name +'select-tag'"
                                            @data="handleTag(file.name, $event)"></choices-vue>
                                    </div>
                                    <div class="mb-1">
                                        <label class="mb-1">License <a
                                                href="https://creativecommons.org/share-your-work/cclicenses/"
                                                target="_blank"><i class="fa-solid fa-section"></i></a></label>
                                        <choices-vue :ref="file.name +'license-tag'" prop_type="license"
                                            :reference="file.name +'license-tag'"
                                            @data="handleLic(file.name, $event)"></choices-vue>
                                    </div>
                                    <div class="mb-1">
                                        <label class="mb-1">Labels</label>
                                        <choices-vue :ref="file.name +'select-label'" prop_type="labels"
                                            :reference="file.name +'select-label'"
                                            @data="handleLabel(file.name, $event)"></choices-vue>
                                    </div>

                                </div>

                            </div>
                        </div>

                    </div>
                    <div class="d-flex flex-column text-end d-none" v-if="FileInfo['thumb' + file.name]">
                        <div class="small text-muted">File: {{FileInfo[file.name].hash}}</div>
                        <div class="small text-muted text-break">Thumbnail: {{FileInfo['thumb' + file.name].hash}}</div>
                    </div>
                </div>
            </div>




            <div id="listOfEncs" v-if="encryption.encrypted" v-for="(file, key,index) in FileInfo">
                <div class="p-3 mb-2 bg-dark" v-if="!FileInfo[file.name].is_thumb">
                    <div class="d-flex flex-wrap align-items-center pb-2 mb-2">
                        <div>
                            <h6 class="m-0 text-break"><span class="px-2 py-1 me-2 bg-darkg rounded"><i
                                        class="fa-solid fa-lock fa-fw"></i></span>{{file.name}}</h6>
                        </div>
                        <div class="flex-grow-1 mx-5" v-if="File[FileInfo[file.name].enc_index].actions.cancel">
                            <div class="progress" role="progressbar" aria-label="Upload progress" aria-valuenow="25"
                                aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar"
                                    :style="'width: ' + File[FileInfo[file.name].enc_index].progress + '%'">
                                    {{File[FileInfo[file.name].enc_index].progress}}%
                                </div>
                            </div>
                        </div>
                        <div class="flex-shrink" v-if="File.length">
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="File[FileInfo[file.name].enc_index].actions.pause"
                                @click="fileRequest[FileInfo[file.name].enc_index].resumeFileUpload()">Pause</button>
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="File[FileInfo[file.name].enc_index].actions.resume"
                                @click="fileRequest[FileInfo[file.name].enc_index].resumeFileUpload()">Resume</button>
                            <button type="button" class="me-2 btn btn-secondary"
                                v-if="File[FileInfo[file.name].enc_index].actions.cancel"
                                @click="fileRequest[FileInfo[file.name].enc_index].resumeFileUpload()">Cancel</button>
                        </div>
                        <div class="ms-auto">
                            <button class="btn btn-danger" @click="deleteImg(FileInfo[file.name].enc_index, file.name)"
                                data-toggle="tooltip" data-placement="top" title="Delete Asset"><i
                                    class="fas fa-fw fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="d-flex flex-column w-100" v-if="FileInfo[file.name]">

                        <div class="">Bytes: {{fancyBytes(FileInfo[file.name].enc_size)}}</div>
                        <div class="">CID:
                            {{FileInfo[file.name].enc_hash}}</div>
                        <div class="">Status:
                            {{FileInfo[file.name].status}}
                        </div>
                        <div class=""><a :href="'https://ipfs.dlux.io/ipfs/' + FileInfo[file.name].enc_hash"
                                target="_blank" class="btn btn-primary">Copy URL<i
                                    class="fa-solid fa-up-right-from-square fa-fw ms-1"></i></a>
                        </div>

                    </div>
                </div>
            </div>

        </div>







        <!-- encryption banner -->
        <div class="card card-body d-flex align-items-center mx-lg-5 my-3">
            <div class="d-flex flex-column w-100 flex-grow-1 mx-1 px-md-2 px-lg-5">

                <!-- bubble preview -->
                <div class="d-flex justify-content-center flex-wrap fs-3 fw-lighter mb-3">
                    <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                        <div> Privacy </div>
                        <span v-if="!encryption.encrypted"><i class="mx-2 fa-solid fa-fw fa-lock-open"></i></span>
                        <span v-if="encryption.encrypted"><i class="mx-2 fa-solid fa-fw fa-lock"></i></span>
                        <div>
                            <span v-if="!encryption.encrypted" class="fw-bold">Public</span>
                            <span v-if="encryption.encrypted" class="fw-bold">Private</span>
                        </div>
                    </div>
                </div>

                <!-- encrypt switch -->
                <div v-if="contract.c == 1"
                    class="flex-grow-1 border-top border-bottom border-light border-1 py-2 mb-2">
                    <div class="form-check form-switch d-flex align-items-center ps-0 mt-2 mb-3">
                        <label class="form-check-label mb-0" for="encryptCheck">ENCRYPT FILES</label>
                        <input class="form-check-input fs-2 ms-auto mt-0" type="checkbox" role="switch"
                            id="encryptCheck" v-model="encryption.encrypted">
                    </div>

                    <div v-if="!encryption.encrypted" class="mb-2">Files uploaded to this contract will not be
                        encrypted, <b>they will be publicly available on SPK Network</b></div>
                    <div v-if="encryption.encrypted" class="mb-2">Files uploaded to this contract will be encrypted,
                        <b>only the accounts you add will have access.</b>
                    </div>


                </div>


                <!-- encrypted sharing -->
                <div v-if="encryption.encrypted">
                    <div class="fs-3 fw-lighter">Sharing:</div>
                    <p>You can share the decryption key with a few other accounts to view the files, and you can
                        revoke
                        access at any time.</p>
                    <div class="d-flex mb-2">
                        <div class="me-1 flex-grow-1">
                            <div class="position-relative has-validation">
                                <input autocapitalize="off" placeholder="username"
                                    class="form-control border-light bg-darkg text-info" v-model="encryption.input"
                                    @blur="addUser()" @keyup.enter="addUser(contract.i)">
                            </div>
                        </div>
                        <div class="ms-1">
                            <div class="btn btn-lg btn-light" @click="addUser()"><i class="fa-solid fa-fw fa-plus"></i>
                            </div>
                        </div>
                    </div>
                    <!-- shared accounts -->
                    <div class="d-flex flex-row flex-wrap">
                        <div v-for="(a,b,c) in encryption.accounts"
                            class="rounded text-black filter-bubble bg-white me-1 mb-1 d-flex align-items-center">
                            <!-- warning class for unencrypted keys -->
                            <i class="fa-solid fa-key fa-fw me-1"
                                :class="{'text-primary': encryption.accounts[b].enc_key, 'text-warning': !encryption.accounts[b].enc_key}"></i>
                            <span>{{b}}</span>
                            <div v-if="b != contract.t"><button type="button"
                                    class="ms-1 btn-close small btn-close-white" @click="delUser(b)"></button></div>
                        </div>
                    </div>
                    <!-- update button -->
                    <div class="d-flex mt-3">
                        <button v-if="unkeyed" @click="checkHive()" class="mx-auto btn btn-lg btn-outline-warning"><i
                                class="fa-solid fa-fw fa-user-lock me-2"></i>Encrypt Keys</button>
                    </div>
                </div>
                <div class="d-flex mb-1" v-if="contract.c == 1">
                    <button class="ms-auto me-auto mt-2 btn btn-lg btn-info" :class="{'disabled': (!reallyReady || !filesReady)}"
                        :disabled="(!reallyReady || !filesReady)" @click="signNUpload()"><i
                            class="fa-solid fa-file-signature fa-fw me-2"></i>Sign and Upload</button>
                </div>
            </div>
        </div>
        <!-- end encryption banner -->
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
      fetching: false,
      contract: {
        id: '',
        api: ''
      },
      encryption: {
        input: '',
        key: '',
        encrypted: false,
        accounts: {},
      },
      fileRequests: {},
      FileInfo: {},
      File: [],
      ready: false,
      deletable: true,
    };
  },
  emits: ["tosign", "done"],
  methods: {
    addUser() {
      if (this.encryption.input) {
        this.encryption.accounts[this.encryption.input] = {
          key: '',
          enc_key: '',
        }
        this.encryption.input = ''
      }
    },
    delUser(user) {
      delete this.encryption.accounts[user]
    },
    fancyBytes(bytes) {
      var counter = 0, p = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
      while (bytes > 1024) {
        bytes = bytes / 1024
        counter++
      }
      return `${this.toFixed(bytes, 2)} ${p[counter]}B`
    },
    handleLabel(n, m) {
      if (m.action == 'added') {
        var string = this.FileInfo[n].meta.labels
        if (!string) string = '2'
        this.FileInfo[n].meta.labels += m.item
      } else {
        console.log('remove', m.item)
        var string = this.FileInfo[n].meta.labels
        var arr = string.split('')
        for (var j = 1; j < arr.length; j++) {
          if (arr[j] == m.item) arr.splice(j, 1)
        }
        this.FileInfo[n].meta.labels = arr.join('')
      }
    },
    handleLic(n, m) {
      if (m.action == 'added') this.FileInfo[n].meta.license = m.item
      else this.FileInfo[n].meta.license = ''
    },
    handleTag(n, m) {
      var num = this.Base64toNumber(this.FileInfo[n].meta.flag) || 0
      if (m.action == 'added') {
        if (num & m.item) { }
        else num += m.item
        this.FileInfo[n].meta.flag = (this.NumberToBase64(num) || "0")
      } else {
        if (num & m.item) num -= m.item
        this.FileInfo[n].meta.flag = (this.NumberToBase64(num) || "0")
      }
    },
    checkHive() {
      return new Promise((resolve, reject) => {
        this.fetching = true
        var accounts = Object.keys(this.encryption.accounts)
        var newAccounts = []
        for (var i = 0; i < accounts.length; i++) {
          if (!this.encryption.accounts[accounts[i]]?.key) {
            newAccounts.push(accounts[i])
          }
        }

        if (newAccounts.length) fetch('https://api.hive.blog', {
          method: 'POST',
          body: JSON.stringify({
            "jsonrpc": "2.0",
            "method": "condenser_api.get_accounts",
            "params": [newAccounts],
            "id": 1
          })
        }).then(response => response.json())
          .then(data => {
            this.fetching = false
            if (data.result) {
              for (var i = 0; i < data.result.length; i++) {
                if (data.result[i].id) {
                  this.encryption.accounts[data.result[i].name].key = data.result[i].memo_key
                }
              }
              this.encryptKeyToUsers()
              resolve(data.result)
            } else {
              reject(data.error)
            }
          })
          .catch(e => {
            this.fetching = false
          })
      })
    },
    toFixed(n, digits) {
      return parseFloat(n).toFixed(digits)
    },
    encryptKeyToUsers(usernames) {
      return new Promise((resolve, reject) => {
        if (!usernames) usernames = Object.keys(this.encryption.accounts)
        var keys = []
        var dict = {}
        for (var i = 0; i < usernames.length; i++) {
          if (!this.encryption.accounts[usernames[i]].enc_key) keys.push(this.encryption.accounts[usernames[i]].key)
          dict[this.encryption.accounts[usernames[i]].key] = usernames[i]
        }
        const key = "#" + this.encryption.key;
        if (keys.length) hive_keychain.requestEncodeWithKeys(this.user.name, keys, key, 'Memo', (response) => {
          if (response.success) {
            for (var node in response.result) {
              this.encryption.accounts[dict[node]].enc_key = response.result[node]
            }
            resolve("OK")
          } else {
            reject(response.message);
          }
        });
        else resolve(null)
      })
    },
    decryptMessage(username = this.user.name, encryptedMessage) {
      return new Promise((resolve, reject) => {
        let encryptedKey = encryptedMessage.split("#")[1];
        let encryptedMessageOnly = encryptedMessage.split("#")[2];
        console.log("Encrypted message: ", encryptedMessageOnly);
        hive_keychain.requestVerifyKey(username, '#' + encryptedKey, 'Memo', (response) => {
          if (response.success) {
            let key = response.result;
            this.encryption.key = key
            resolve(key)
          } else {
            reject(response.message);
          }
        });
      })
    },
    makeThumb(img) {
      return new Promise((resolve, reject) => {
        var originalImage = new Image();
        originalImage.src = img
        originalImage.addEventListener("load", function () {
          var thumbnailImage = createThumbnail();
          resolve(thumbnailImage);
        });
        function createThumbnail(image) {
          var canvas, ctx, thumbnail
          canvas = document.createElement('canvas');
          ctx = canvas.getContext('2d');
          canvas.width = 128
          canvas.height = 128
          ctx.drawImage(image, 0, 0, 128, 128);
          thumbnail = new Image();
          thumbnail.src = canvas.toDataURL('image/jpeg', 70);
          return thumbnail;
        }
      })
    },
    AESEncrypt(message, key = this.encryption.key) {
      if (typeof message != 'string') message = CryptoJS.lib.WordArray.create(message)
      return CryptoJS.AES.encrypt(message, key).toString()
    },
    AESDecrypt(encryptedMessage, key) {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
      return bytes.toString(CryptoJS.enc.Utf8);
    },
    hashOf(buf, opts) {
      return new Promise((resolve, reject) => {
        Hash.of(buf, { unixfs: 'UnixFS' }).then(hash => {
          resolve({ hash, opts })
        })
      })
    },
    encryptFileAndPlace(fileInfo) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const fileContent = event.target.result;
          const encrypted = this.AESEncrypt(fileContent, this.encryption.key);
          var newFile = new File([encrypted], fileInfo.name, { type: fileInfo.type });
          newFile.progress = 0;
          newFile.status = 'Pending Signature';
          newFile.actions = {
            cancel: false,
            pause: false,
            resume: false,
          }
          const Reader = new FileReader();
          Reader.onload = (Event) => {
            const encFileContent = Event.target.result;
            const buf = buffer.Buffer(encFileContent)
            const size = buf.byteLength
            this.hashOf(buf, {}).then((ret) => {
              const newIndex = this.File.length
              this.FileInfo[fileInfo.name].enc_hash = ret.hash
              this.FileInfo[fileInfo.name].enc_index = newIndex
              this.FileInfo[fileInfo.name].enc_size = size
              this.File.push(newFile);
            })
            resolve(encrypted)
          }
          Reader.readAsArrayBuffer(newFile);
        };
        reader.readAsDataURL(this.File[fileInfo.index]);
      })
    },
    resetThumb(n) {
      this.FileInfo['thumb' + n].use_thumb = !this.FileInfo['thumb' + n].use_thumb
      this.FileInfo[n].meta.thumb = this.FileInfo['thumb' + n].use_thumb ? this.FileInfo[n].thumb : ''
    },
    uploadFile(e) {
      for (var i = 0; i < e.target.files.length; i++) {
        var reader = new FileReader();
        reader.File = e.target.files[i]
        const thisFileIndex = i
        reader.onload = (Event) => {
          const event = Event
          const target = event.currentTarget ? event.currentTarget : event.target
          const fileContent = target.result;
          for (var j = 0; j < this.File.length; j++) {
            if (
              this.File[j].name == target.File.name
              && this.File[j].size == target.File.size
            ) {
              this.hashOf(buffer.Buffer(fileContent), { i: j }).then((ret) => {
                const dict = { fileContent: new TextDecoder("utf-8").decode(fileContent), hash: ret.hash, index: ret.opts.i, size: target.File.size, name: target.File.name, path: e.target.id, progress: 0, status: 'Pending Signature' }
                console.log({ dict })
                fetch(`https://spktest.dlux.io/api/file/${ret.hash}`).then(r => r.json()).then(res => {
                  if (res.result == "Not found") {
                    this.FileInfo[dict.name] = dict
                    const names = dict.name.replaceAll(',', '-').split('.')
                    const ext = names[names.length - 1]
                    const name = names.slice(0, names.length - 1).join('.')
                    this.FileInfo[dict.name].meta = {
                      name,
                      ext,
                      flag: "",
                      labels: "",
                      thumb: "",
                      license: "",
                    }
                    const file = this.File[ret.opts.i];
                    this.File.splice(ret.opts.i, 1, file);
                    this.encryptFileAndPlace(dict)
                    let that = this
                    var thumb = new FileReader();
                    thumb.onload = (e) => {
                      var originalImage = new Image();
                      originalImage.src = e.target.result
                      originalImage.addEventListener("load", function () {
                        var thumbnailImage = createThumbnail(originalImage);
                        var newFile = new File([thumbnailImage.src], 'thumb' + target.File.name, { type: 'jpeg' });
                        console.log({ newFile })
                        newFile.progress = 0;
                        newFile.status = 'Pending Signature';
                        newFile.actions = {
                          cancel: false,
                          pause: false,
                          resume: false,
                        }
                        const Reader = new FileReader()
                        Reader.onload = (Event) => {
                          const thumbFileContent = Event.target.result;
                          const buf = buffer.Buffer(thumbFileContent)
                          const size = buf.byteLength
                          that.hashOf(buf, {}).then((ret) => {
                            const newIndex = that.File.length
                            const dict = { fileContent: new TextDecoder("utf-8").decode(thumbFileContent), hash: ret.hash, index: newIndex, size: buf.byteLength, name: 'thumb' + target.File.name, path: e.target.id, progress: 0, status: 'Pending Signature', is_thumb: true, use_thumb: true }
                            that.FileInfo[target.File.name].thumb_index = newIndex
                            that.FileInfo[target.File.name].thumb = ret.hash
                            that.FileInfo['thumb' + target.File.name] = dict
                            const names = dict.name.replaceAll(',', '-').split('.')
                            const ext = names[names.length - 1]
                            const name = names.slice(0, names.length - 1).join('.')
                            that.FileInfo['thumb' + target.File.name].meta = {
                              name,
                              ext,
                              flag: "2",
                              labels: "",
                              thumb: "",
                              license: "",
                            }
                            that.FileInfo[target.File.name].meta.thumb = ret.hash
                            that.File.push(newFile);

                          })
                        }
                        Reader.readAsArrayBuffer(newFile);
                      })
                      function createThumbnail(image) {
                        var canvas, ctx, thumbnail
                        canvas = document.createElement('canvas');
                        ctx = canvas.getContext('2d');
                        canvas.width = 128
                        canvas.height = 128
                        ctx.drawImage(image, 0, 0, 128, 128);
                        thumbnail = new Image();
                        thumbnail.src = canvas.toDataURL('image/jpeg', 70);
                        return thumbnail;
                      }
                    }
                    thumb.readAsDataURL(e.target.files[thisFileIndex]);
                  } else {
                    alert(`${target.File.name} already uploaded`)
                    delete this.FileInfo[dict.name]
                    this.File.splice(ret.opts.i, 1)
                  }
                })
              })
              break
            }
          }
        };

        reader.readAsArrayBuffer(e.target.files[i])
        var file = e.target.files[i];
        file.hash = "computing..."
        file.progress = 0;
        file.actions = {
          cancel: false,
          pause: false,
          resume: false,
        }
        this.File.push(file);
      }
      this.ready = true
    },
    dragFile(e) {
      e.preventDefault();
      var FilesTxs = {}
      for (var i = 0; i < e.dataTransfer.files.length; i++) {
        const thisFileIndex = i
        var reader = new FileReader();
        FilesTxs[i] = e.dataTransfer.files[i]
        reader.File = e.dataTransfer.files[i]
        reader.onload = (Event) => {
          const event = Event
          const target = event.currentTarget ? event.currentTarget : event.target
          const fileContent = event.target.result;
          for (var j = 0; j < this.File.length; j++) {
            if (
              this.File[j].name == target.File.name
              && this.File[j].size == target.File.size
            ) {
              this.hashOf(buffer.Buffer(fileContent), { i: j }).then((ret) => {
                const dict = { fileContent: new TextDecoder("utf-8").decode(fileContent), hash: ret.hash, index: ret.opts.i, size: target.File.size, name: target.File.name, nsfw: false, autoRenew: true, executable: false, path: e.target.id, progress: 0, status: 'Pending Signature' }

                fetch(`https://spktest.dlux.io/api/file/${ret.hash}`).then(r => r.json()).then(res => {
                  if (res.result == "Not found") {
                    this.FileInfo[dict.name] = dict
                    const names = dict.name.replaceAll(',', '-').split('.')
                    const ext = names[names.length - 1]
                    const name = names.slice(0, names.length - 1).join('.')
                    this.FileInfo[dict.name].meta = {
                      name,
                      ext,
                      flag: "",
                      labels: "",
                      thumb: "",
                      license: "",
                    }
                    const file = this.File[ret.opts.i];
                    this.File.splice(ret.opts.i, 1, file);
                    this.encryptFileAndPlace(dict)
                    let that = this
                    var thumb = new FileReader();
                    thumb.onload = (ev) => {
                      var originalImage = new Image();
                      originalImage.src = ev.target.result
                      originalImage.addEventListener("load", function () {
                        var thumbnailImage = createThumbnail(originalImage);
                        var newFile = new File([thumbnailImage.src], 'thumb' + target.File.name, { type: 'jpeg' });
                        newFile.progress = 0;
                        newFile.status = 'Pending Signature';
                        newFile.actions = {
                          cancel: false,
                          pause: false,
                          resume: false,
                        }
                        const Reader = new FileReader()
                        Reader.onload = (Event) => {
                          const thumbFileContent = Event.target.result;
                          const buf = buffer.Buffer(thumbFileContent)
                          const size = buf.byteLength
                          that.hashOf(buf, {}).then((ret) => {
                            const newIndex = that.File.length
                            const dict = { fileContent: new TextDecoder("utf-8").decode(thumbFileContent), hash: ret.hash, index: newIndex, size: buf.byteLength, name: 'thumb' + target.File.name, path: e.target.id, progress: 0, status: 'Pending Signature', is_thumb: true, use_thumb: true }
                            that.FileInfo[target.File.name].thumb_index = newIndex
                            that.FileInfo[target.File.name].thumb = ret.hash
                            that.FileInfo['thumb' + target.File.name] = dict
                            const names = dict.name.replaceAll(',', '-').split('.')
                            const ext = names[names.length - 1]
                            const name = names.slice(0, names.length - 1).join('.')
                            that.FileInfo['thumb' + target.File.name].meta = {
                              name,
                              ext,
                              flag: "2",
                              labels: "",
                              thumb: "",
                              license: "",
                            }
                            that.FileInfo[target.File.name].meta.thumb = ret.hash
                            that.File.push(newFile);
                          })
                        }
                        Reader.readAsArrayBuffer(newFile);
                      })
                      function createThumbnail(image) {
                        var canvas, ctx, thumbnail
                        canvas = document.createElement('canvas');
                        ctx = canvas.getContext('2d');
                        canvas.width = 128
                        canvas.height = 128
                        ctx.drawImage(image, 0, 0, 128, 128);
                        thumbnail = new Image();
                        thumbnail.src = canvas.toDataURL('image/jpeg', 70);
                        return thumbnail;
                      }
                    }
                    thumb.readAsDataURL(FilesTxs[thisFileIndex]);
                  } else {
                    alert(`${target.File.name} already uploaded`)
                    delete this.FileInfo[dict.name]
                    this.File.splice(ret.opts.i, 1)
                  }
                })
              })
              break
            }
          }
        };

        reader.readAsArrayBuffer(e.dataTransfer.files[i]);
        var file = e.dataTransfer.files[i]
        file.hash = "computing..."
        file.progress = 0;
        file.actions = {
          cancel: false,
          pause: false,
          resume: false,
        }
        this.File.push(file);
      }
      this.ready = true
    },
    deleteImg(index, name) {
      for (var item in this.FileInfo) {
        if (this.FileInfo[item].index > index) {
          this.FileInfo[item].index--
        }
      }
      this.File.splice(index, 1)
      delete this.FileInfo[name]
      delete this.FileInfo['thumb' + name]
    },
    signNUpload() {
      console.log(this.contract.i)
      var header = `${this.contract.i}`
      var body = ""
      var names = Object.keys(this.FileInfo)
      var cids = []
      var meta = {}
      if (!this.encryption.encrypted) for (var i = 0; i < names.length; i++) {
        if ((this.FileInfo[names[i]].is_thumb && this.FileInfo[names[i]].use_thumb) || !this.FileInfo[names[i]].is_thumb) {
          meta[this.FileInfo[names[i]].hash] = `,${this.FileInfo[names[i]].meta.name},${this.FileInfo[names[i]].meta.ext},${this.FileInfo[names[i]].meta.thumb},${this.FileInfo[names[i]].is_thumb ? '2' : this.FileInfo[names[i]].meta.flag}-${this.FileInfo[names[i]].meta.license}-${this.FileInfo[names[i]].meta.labels}`
          body += `,${this.FileInfo[names[i]].hash}`
          cids.push(this.FileInfo[names[i]].hash)
        }
      }
      else for (var i = 0; i < names.length; i++) {
        if (this.FileInfo[names[i]].enc_hash) {
          meta[this.FileInfo[names[i]].enc_hash] = `,${this.FileInfo[names[i]].meta.name},${this.FileInfo[names[i]].meta.ext},,${this.FileInfo[names[i]].meta.flag + 1}--${this.FileInfo[names[i]].meta.labels}`
          body += `,${this.FileInfo[names[i]].enc_hash}`
          cids.push(this.FileInfo[names[i]].enc_hash)
        }
      }
      this.contract.files = body
      this.signText(header + body).then(res => {
        this.meta = meta
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
    stringOfKeys() {
      if (!this.encryption.encrypted) return ''
      var keys = []
      var accounts = Object.keys(this.encryption.accounts)
      for (var i = 0; i < accounts.length; i++) {
        keys.push(`${this.encryption.accounts[accounts[i]].enc_key}@${accounts[i]}`)
      }
      return keys.join(';')
    },
    flagEncode(fileInfo) {
      var num = 0
      if (fileInfo.encrypted) num += 1
      if (fileInfo.is_thumb) num += 2
      if (fileInfo.nsfw) num += 4
      if (fileInfo.executable) num += 8
      var flags = this.NumberToBase64(num)
      //append category chars here
      return flags
    },
    flagDecode(flags) {
      var num = this.Base64toNumber(flags)
      var out = {}
      if (num & 1) out.enc = true
      if (num & 2) out.autoRenew = true
      if (num & 4) out.nsfw = true
      if (num & 8) out.executable = true
      return out
    },
    Base64toNumber(chars) {
      const glyphs =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
      var result = 0;
      chars = chars.split("");
      for (var e = 0; e < chars.length; e++) {
        result = result * 64 + glyphs.indexOf(chars[e]);
      }
      return result;
    },
    NumberToBase64(num) {
      const glyphs =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
      var result = "";
      while (num > 0) {
        result = glyphs[num % 64] + result;
        num = Math.floor(num / 64);
      }
      return result;
    },
    upload(cids = ['QmYJ2QP58rXFLGDUnBzfPSybDy3BnKNsDXh6swQyH7qim3'], contract) { // = { api: 'https://ipfs.dlux.io', id: '1668913215284', sigs: {}, s: 10485760, t: 0 }) {
      cids = cids.sort(function (a, b) {
        if (a < b) { return -1; }
        if (a > b) { return 1; }
        return 0;
      })
      var meta = `1${this.stringOfKeys()}`
      for (var i = 0; i < cids.length; i++) {
        meta += this.meta[cids[i]]
      }
      console.log({ cids }, meta)
      var files = []
      for (var name in this.FileInfo) {
        for (var i = 0; i < cids.length; i++) {
          if (this.FileInfo[name].hash == cids[i]) {
            this.File[this.FileInfo[name].index].cid = cids[i]
            files.push(this.File[this.FileInfo[name].index])
            break;
          } else if (this.FileInfo[name].enc_hash == cids[i]) {
            this.File[this.FileInfo[name].enc_index].cid = cids[i]
            files.push(this.File[this.FileInfo[name].enc_index])
            break;
          }
        }
      }
      console.log({ cids }, files, meta)
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
        meta: encodeURI(meta),
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
          this.FileInfo[f.name].status = this.File[this.FileInfo[f.name].index].progress < 100 ? `uploading(${this.File[this.FileInfo[f.name].index].progress}%)` : 'done'
          // fileObj.status = FILE_STATUS.UPLOADING;
          // fileObj.percentage = e.percentage;
          // fileObj.uploadedChunkSize = e.loaded;

          // updateFileElement(fileObj);
        },
        onError: (e, f) => {
          console.log('options.onError', e, f)
          if (e.name) {
            // const fileObj = files.get(file);
            this.FileInfo[e.name].status = '!!ERROR!!'
            // fileObj.status = FILE_STATUS.FAILED;
            // fileObj.percentage = 100;
            this.File[this.FileInfo[e.name].index].actions.pause = false
            this.File[this.FileInfo[e.name].index].actions.resume = true
            this.File[this.FileInfo[e.name].index].actions.cancel = true
            // updateFileElement(fileObj);
          }
        },
        onComplete: (e, f) => {
          console.log('options.onComplete', e, f)
          this.File[this.FileInfo[f.name].index].actions.pause = false
          this.File[this.FileInfo[f.name].index].actions.resume = false
          this.File[this.FileInfo[f.name].index].actions.cancel = false
          this.FileInfo[f.name].progress = 100
          this.File[this.FileInfo[f.name].index].progress = 100
          this.FileInfo[f.name].status = 'done'
          var done = true
          for (var file in this.FileInfo) {
            if (this.FileInfo[file].status != 'done') {
              done = false
              break;
            }
          }
          if (done) {
            setTimeout(() => {
              this.$emit('done', this.contract)
            }, 5000)
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
        req.setRequestHeader('X-Meta', options.meta);


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
            'X-Meta': options.meta,
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
    },
    unkeyed() {
      if (!this.encryption.encrypted) return false
      var accounts = Object.keys(this.encryption.accounts)
      for (var i = 0; i < accounts.length; i++) {
        if (!this.encryption.accounts[accounts[i]].enc_key) return true
      }
      return false
    },
    reallyReady() {
      return this.ready && !this.unkeyed
    },
    fileCount() {
      var thumbs = 0
      var files = 0
      for (var item in this.FileInfo) {
        if (this.FileInfo[item].use_thumb) thumbs++
        else if (this.FileInfo[item].is_thumb) { }
        else files++
      }
      if (!this.encryption.encrypted) return `${files} file${files > 1 ? 's' : ''} ${thumbs ? `with ${thumbs} thumbnail${thumbs > 1 ? 's' : ''}` : ''}`
      else return `${files} encrypted file${files > 1 ? 's' : ''}`
    },
    filesReady() {
      var files = 0
      for (var item in this.FileInfo) {
        if (!this.FileInfo[item].is_thumb)  files++
      }
      return files > 0
    },
    totalSize() {
      var size = 0
      var cids = []
      var names = Object.keys(this.FileInfo)
      if (!this.encryption.encrypted) for (var i = 0; i < names.length; i++) {
        if ((this.FileInfo[names[i]].is_thumb && this.FileInfo[names[i]].use_thumb) || !this.FileInfo[names[i]].is_thumb) {
          cids.push(this.FileInfo[names[i]].hash)
        }
      }
      else for (var i = 0; i < names.length; i++) {
        if (this.FileInfo[names[i]].enc_hash) {
          cids.push(this.FileInfo[names[i]].enc_hash)
        }
      }
      for (var name in this.FileInfo) {
        for (var i = 0; i < cids.length; i++) {
          if (this.FileInfo[name].hash == cids[i]) {
            size += this.File[this.FileInfo[name].index].size
            break;
          } else if (this.FileInfo[name].enc_hash == cids[i]) {
            size += this.File[this.FileInfo[name].enc_index].size
            break;
          }
        }
      }
      return size
    }
  },
  mounted() {
    this.contract = this.propcontract;
    this.selectContract(this.contract.i, this.contract.b)
    this.encryption.key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    this.encryption.accounts[this.user.name] = {
      key: '',
      enc_key: '',
    }
  },
};