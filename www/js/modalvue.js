const { Modal } = bootstrap;

export default {
  name: "ModalVue",
  data() {
    return {
      valCodeDict: {},
      spkprefix: "spkcc",
      valid: false,
      d: {
        spkprefix: "spkcc",
        valWorkable: [],
        test: false
      },
    };
  },
  template: `
<div>

<!-- Extend -->
<div class="modal fade" id="extend" :tabindex="i" role="dialog" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" role="document">
    <div class="modal-content bg-darker text-white">
        <div class="modal-header">
            <h5 class="modal-title">Extend {{contract.i}}</h5> 
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <form name="sendhive">
            <div class="modal-body text-start"> 
              <label class="small mb-1" for="sendhivefrom">From</label>
              <div class="position-relative mb-3">
                <span class="position-absolute top-50 translate-middle-y ps-2">
                  <i class="fa-solid fa-at fa-fw"></i>
                </span>
                  <input class="ps-4 form-control text-white bg-dark border-dark" type="text" placeholder="Please login" :value="account" readonly> 
                </div> 
                <div class="mb-3"> 
                  <label class="small" for="sendhiveto">Increase Decentralization</label>
                  <input class="form-check-input" type="checkbox" role="switch" v-model="d.up"> 
                </div> 
                <label class="small mb-1 d-flex" for="sendAmount">Amount
                  <span class="ms-auto">Balance: <a class="text-info" role="button" @click="d.amount = balance">{{formatNumber(balance, 0, '', ',')}}</a> {{token}}</span></label>
                <div class="position-relative">
                  <input class="pe-5 form-control text-white bg-dark border-dark" id="sendAmount" type="number" step="1" :min="contract.r" placeholder="Enter amount" v-model="d.amount"> 
                  <span class="position-absolute end-0 top-50 translate-middle-y px-2">
                    {{token}}
                  </span>
                </div> 
            </div>
            <div class="modal-footer"> 
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button> 
              <button type="submit" class="btn btn-primary" @click="extend" data-bs-dismiss="modal">Extend</button> 
            </div>
        </form>
    </div>
  </div>
</div>

<!-- Send -->
  <div class="modal fade" id="send" :tabindex="i" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content bg-darker text-white">
              <div class="modal-header">
                  <h5 class="modal-title">Send {{token}}</h5> <button type="button" class="btn-close " data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <form name="sendhive">
                    <div class="modal-body text-start">
                      <label class="small mb-1" for="sendhivefrom">From</label>
                      <div class="position-relative mb-3">
                        <span class="position-absolute top-50 translate-middle-y ps-2">
                          <i class="fa-solid fa-at fa-fw"></i>
                        </span>
                        <input class="ps-4 form-control bg-dark border-dark" type="text" placeholder="Please login" :value="account" readonly>
                      </div>
                      <label class="small mb-1" for="sendhiveto">To</label>
                      <div class="position-relative mb-3">
                        <span class="position-absolute top-50 translate-middle-y ps-2">
                          <i class="fa-solid fa-at fa-fw"></i>
                        </span>
                        <input @blur="accountCheck" class="ps-4 form-control text-white bg-dark border-dark" type="text" placeholder="Payment recipient" v-model="d.to">
                      </div>
                      <label class="small mb-1 d-flex" for="sendAmount">Amount 
                        <span class="ms-auto">
                          Balance: <a role="button" class="text-info" @click="d.amount = balance / 1000">{{formatNumber((balance)/1000, 3, '.', ',')}}</a> {{token}}
                        </span>
                      </label>
                      <div class="position-relative mb-3">
                        <input class="pe-5 form-control text-white bg-dark border-dark" id="sendAmount" type="number" step="0.001" min="0.001" placeholder="Enter amount" v-model="d.amount">
                        <span class="position-absolute end-0 top-50 translate-middle-y px-2">
                          {{token}}
                        </span>
                      </div>
                      <label class="small mb-1" for="sendhivememo">Memo</label>
                      <div class="input-group">
                        <input class="form-control text-white bg-dark border-dark" type="text" placeholder="Include a memo (optional)" v-model="d.memo">
                      </div>
                  </div>
                  <div class="modal-footer"> 
                    <div class="me-auto btn-group border border-info rounded px-2 py-1" role="group" aria-label="Transaction on Test Network Only" v-if="token == 'SPK' || token == 'LARYNX'">
                      <input id="sendmirror" type="checkbox" v-model="d.test" class="me-2">
                      <label for="sendmirror">Test Network Only</label>
                    </div>
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button> 
                  <button :disabled="!d.valid" type="submit" class="btn btn-primary" @click="send" data-bs-dismiss="modal">Send</button> 
                  </div>
              </form>
          </div>
      </div>
  </div>

  <!-- Delegation -->
  <div class="modal fade" id="delegate" :tabindex="i" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content bg-darker text-white">
              <div class="modal-header">
                  <h5 class="modal-title">Delegate {{token}}</h5> 
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <form name="sendhive">
                <div class="modal-body text-start"> 
                  <label class="small mb-1" for="sendhivefrom">From</label>
                  <div class="position-relative mb-3">
                    <span class="position-absolute top-50 translate-middle-y ps-2">
                      <i class="fa-solid fa-at fa-fw"></i>
                    </span>
                    <input class="ps-4 form-control bg-dark border-dark text-white" type="text" placeholder="Please login" :value="account" readonly>
                  </div>
                  <label for="sendhiveto" class="small mb-1">To</label>
                  <div class="position-relative mb-3" v-if="token == 'LARYNX'">
                    <span class="position-absolute top-50 translate-middle-y ps-2">
                      <i class="fa-solid fa-at fa-fw"></i>
                    </span> 
                    <select class="ps-4 form-select text-white bg-dark border-dark" id="datalistOptions" v-model="d.to">
                      <option value="" disabled selected>Select node operator</option>
                      <option v-for="node in smarkets" :value="node.self">{{node.lastGood >= stats.head_block - 1200 ? '🟩': node.lastGood > stats.head_block - 28800  ? '🟨' : '🟥'}} {{node.self}}</option>
                    </select> 
                  </div>
                  <div class="position-relative mb-3" v-if="token == 'DLUX'">
                    <span class="position-absolute top-50 translate-middle-y ps-2">
                      <i class="fa-solid fa-at fa-fw"></i>
                    </span>  
                    <input @blur="accountCheck" class="ps-4 form-control bg-dark border-dark text-white" type="text" placeholder="Recipient" v-model="d.to"> 
                  </div>
                  <label for="delAmount" class="small mb-1 d-flex">Amount
                    <span class="ms-auto">
                      Balance: <a role="button" class="text-info" @click="d.amount = balance / 1000">{{formatNumber((balance)/1000, 3, '.', ',')}}</a> {{token}}
                    </span>
                  </label>
                  <div class="position-relative">
                    <input class="pe-5 form-control bg-dark border-dark text-white" type="number" step="0.001" id="delAmount" min="0.001" placeholder="Enter amount" v-model="d.amount"> 
                    <span class="position-absolute end-0 top-50 translate-middle-y px-2">
                      {{token}}
                    </span> 
                  </div>
                </div>
                <div class="modal-footer">
                  <div class="me-auto btn-group border border-info rounded px-2 py-1" role="group" aria-label="Transact on Test Network Only" v-if="token == 'SPK' || token == 'LARYNX'">
                    <input id="delegatemirror" type="checkbox" v-model="d.test" class="me-2">
                    <label for="delegatemirror">Test Network Only</label>
                  </div>
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button> 
                  <button :disabled="!d.to" type="submit" class="btn btn-primary" @click="delegate" data-bs-dismiss="modal">Confirm</button> 
                </div>
              </form>
          </div>
      </div>
  </div>

  <!-- Power Gov Service -->
  <div class="modal fade" id="power" tabindex="-1" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content bg-darker text-white">
              <div class="modal-header">
                  <h5 class="modal-title">{{func}} | {{token}}  {{func == 'Election' ? 'Validators' : ''}}</h5> 
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <form name="power">
                      
                      <!-- Power / Gov Up / Down -->
                      <div v-if="func == 'Power Up' || func == 'Power Down' || func == 'Lock' || func == 'Unlock'">
                        <div class="modal-body">
                        <label for="poweramount" class="small mb-1 d-flex">Amount<span class="ms-auto">Balance: <a role="button" class="text-info" @click="d.amount = balance / 1000">{{formatNumber((balance)/1000, 3, '.', ',')}}</a> {{token}}</span></label>
                        <div class="position-relative">
                          <input class="pe-5 form-control text-white border-dark bg-dark" type="number" step="0.001" :min="min" :max="formatNumber((balance)/1000, 3, '.', ',')" placeholder="1.000" v-model="d.amount"> 
                          <span class="position-absolute end-0 top-50 translate-middle-y px-2">
                            {{token}}
                          </span>
                        </div>
                        </div>
                        <div class="modal-footer">
                          <div class="me-auto btn-group border border-info rounded px-2 py-1" role="group" aria-label="Transact on Test Network Only" v-if="token == 'LARYNX'">
                            <input id="pwrupmirror" type="checkbox" v-model="d.test" class="me-2">
                            <label for="pwrupmirror">Test Network Only</label>
                          </div>
                          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                          <button type="button" class="btn btn-primary" @click="power" data-bs-dismiss="modal">Continue</button>
                        </div>
                      </div>

                        <!-- Register Service-->
                        <div v-if="func == 'Register a Service' || func == 'Register a Validator'"> 
                          <div class="modal-body text-start">
                            <label for="api" class="small mb-1">Location (ex: https://ipfs.dlux.io)</label>
                            <div class="input-group mb-3" id="api"> 
                              <input class="form-control text-white border-dark bg-dark" type="text" v-model="d.api"> 
                            </div>
                            <label for="peerid" class="small mb-1">Unique ID</label>
                            <div class="input-group mb-3" id="peerid"> 
                              <input class="form-control text-white border-dark bg-dark" type="text" v-model="d.id"> 
                            </div>
                            <label for="peerid" class="small mb-1">Service Type</label>
                            <div class="input-group" id="type"> 
                              <input class="form-control text-white border-dark bg-dark" type="text" v-model="d.to"> 
                            </div>
                            <label for="json" class="small mb-1">Memo</label>
                            <div class="input-group mb-3" id="json"> 
                              <input class="form-control text-white border-dark bg-dark" type="text" v-model="d.memo"> 
                            </div>
                          </div>
                          <div class="modal-footer">
                              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                              <button type="button" class="btn btn-primary" @click="power" data-bs-dismiss="modal">Continue</button>
                          </div>
                        </div>

                      <!-- Register Service Type -->
                      <div v-if="func == 'Register a Service Type'"> 
                        <div class="modal-body text-start">
                          <label for="type" class="small mb-1">Short Name for Service (ex: IPFS)</label>
                          <div class="input-group mb-3" id="api"> 
                            <input class="form-control text-white border-dark bg-dark" type="text" v-model="d.api"> 
                          </div>
                          <label for="peerid" class="small mb-1">Full Name for Service (ex: InterPlanetary File System)</label>
                          <div class="input-group" id="peerid"> 
                            <input class="form-control text-white border-dark bg-dark" type="text" v-model="d.id"> 
                          </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" @click="power" data-bs-dismiss="modal">Continue</button>
                        </div>
                      </div>

                    <!-- Elect Validator -->
                    <div v-if="func == 'Election'">
                      <div class="modal-body">
                        <h3 class="mb-2">Chosen Validators ({{d.valWorkable.length}}/30)</h3>
                        <div class="d-flex justify-content-between align-items-center border-bottom border-secondary py-2 mb-3">
                          <button class="btn btn-success invisible" type="button">Save</button>
                          <h5 class="m-0"> Node (Weight)</h5>
                          <button :class="{'invisible': !difVote}" class="btn btn-success" type="button" @click="valVote()">Save</button>
                        </div>
                        <div class="mb-5">
                          <div class="d-flex justify-content-center" v-if="!d.valWorkable.length">
                            No Validators Added
                          </div>
                          <ul class=" p-0">
                            <div v-for="(node, index) in d.valWorkable">
                              <li @dragstart="pick($event, node, index)" @dragover.prevent @dragenter.prevent @drop="move($event, node, index)" class="hover border border-secondary rounded d-flex align-items-center justify-content-between my-2 drop-zone" draggable="true" style="cursor: move;">
                                <i class="fa-solid fa-grip-lines m-1 ms-3"></i>  
                                <div class="lead m-1">@{{node.self}} ({{formatNumber(((30 - index )/ 30)* 100, 1,  '.', ',')}}%)</div>
                                <button class="btn btn-danger m-1" @click="sub(node)" type="button"><i class="fa-solid fa-minus"></i></button>
                              </li>
                            </div>
                          </ul>
                        </div>
                        <h3 class="mb-3">Validators</h3>
                        <ul class="p-0">
                          <div v-for="node in smarkets">
                            <li v-if="isVal(node) && !isSelected(node.self)" class="border border-secondary rounded d-flex align-items-center justify-content-between my-2">
                              <button class="btn btn-primary invisible" type="button">
                              <i class="fa-solid fa-plus"></i></button>
                              <div class="lead m-1">@{{node.self}}</div>
                              <button :disable="d.valWorkable.length == 30" class="btn btn-primary m-1" @click="add(node)" type="button"><i class="fa-solid fa-plus"></i></button>
                            </li>
                          </div>
                        </ul>
                      </div>

                  </div>  
              </form>
          </div>
      </div>
  </div>

  <!-- Create Contract -->
  <div class="modal fade" id="build" tabindex="-1" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content bg-darker text-white">
              <div class="modal-header">
                  <h5 class="modal-title">Create Contract</h5> 
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <form name="contract">
                    <div class="modal-body text-start"> 
                      <label for="broca" class="small mb-1 d-flex">Amount
                      <span class="ms-auto">Balance: <a role="button" class="text-info" @click="d.amount = balance">{{formatNumber((balance), 0, '', ',')}}</a> {{token}}</span></label>
                      <div class="position-relative mb-1">
                        <input id="broca" class="pe-5 form-control text-white border-dark bg-dark" type="number" step="1" min="100" :max="balance" placeholder="1" v-model="d.amount"> 
                        <span class="position-absolute end-0 top-50 translate-middle-y px-2">
                          {{token}}
                        </span>  
                      </div>
                      <div class="text-center mb-3 small text-muted">~{{fancyBytes(d.amount * 1000)}}</div>
                      <label for="c_to" class="small mb-1">Account to Upload File</label>
                      <div class="position-relative mb-3" id="c_to">
                        <span class="position-absolute top-50 translate-middle-y ps-2">
                          <i class="fa-solid fa-at fa-fw"></i>
                        </span>  
                        <input class="ps-4 form-control text-white border-dark bg-dark" type="text" v-model="d.to"> 
                      </div>
                      <label for="broker" class="small mb-1">IPFS Service Provider</label>
                      <div class="position-relative mb-3" id="broker">
                        <span class="position-absolute top-50 translate-middle-y ps-2">
                          <i class="fa-solid fa-at fa-fw"></i>
                        </span> 
                        <select class="ps-4 form-select text-white bg-dark border-dark" id="sponsoredContracts" v-model="d.broker">
                          <option class="text-white" value="" disabled selected>Select provider</option>
                          <option class="text-white" v-for="(account, key) in ipfsproviders" :value="key">{{key}}</option>
                        </select>
                      </div>
                      <label for="ben_to" class="small mb-1">Beneficiary Account</label>
                      <div class="position-relative mb-3" id="ben_to">
                        <span class="position-absolute top-50 translate-middle-y ps-2">
                          <i class="fa-solid fa-at fa-fw"></i>
                        </span>   
                        <input class="ps-4 form-control text-white border-dark bg-dark" type="text" v-model="d.ben_to"> 
                      </div>
                      <label for="ben" class="small mb-1">Requested Beneficiary Amount</label>
                      <div class="position-relative">
                      <input id="ben" class="pe-5 form-control text-white border-dark bg-dark" type="number" step="0.01" :min="0" :max="100" v-model="d.ben_amount"> 
                        <span class="position-absolute end-0 top-50 translate-middle-y px-2">
                          <i class="fa-solid fa-percent fa-fw"></i>
                        </span>
                      </div>
                    </div> 
                    <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                      <button type="button" class="btn btn-primary" :class="{'disabled': d.amount < 100}" :disabled="d.amount < 100" @click="build" data-bs-dismiss="modal">Propose</button>
                    </div>
              </form>
          </div>
      </div>
  </div>

  

  <!-- Cancel / Remove -->
  <div class="modal fade" id="confirm" tabindex="-1" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content bg-darker text-white">
              <div class="modal-header">
                  <h5 v-if="func == 'powercancel'" class="modal-title">Cancel Power Down?</h5>
                  <h5 v-if="func == 'delcancel'" class="modal-title">Remove Delegation</h5> <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                  <p v-if="func == 'delcancel'">Do you really want to remove the delegation to @dlux-io?</p>
                  <p v-if="func == 'powercancel'">This will cancel the current power down request. Are you sure?</p>
              </div>
              <div class="modal-footer"> <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button> <button type="button" class="btn btn-primary" @click="confirm" data-bs-dismiss="modal">Continue</button> </div>
          </div>
      </div>
  </div>
  <slot name="trigger"></slot>

  <!-- Vote -->
  <div class="modal fade" id="vote" tabindex="-1" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content bg-darker text-white">
              <div class="modal-header">
                  <h5>Vote</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                  <ul>
                            <li>
                                <h6 class="dropdown-header text-center">
                                    {{tokenGov.title}}
                                </h6>
                            </li>
                            <li>
                                <h4 class="text-center text-white-50">
                                    @{{account}}</h4>
                            </li>
                            <li>
                                <form name="nodeSettings"
                                    class="needs-validation" novalidate>
                                    <div class="row mb-3"
                                        v-for="opt in tokenGov.options">
                                        <label :for="opt.json"
                                            class="form-label d-flex">{{opt.title}}:
                                            {{opt.val}}
                                            {{opt.unit}}
                                            <div
                                                class="dropdown show d-flex align-items-center p-0 m-0">
                                                <a class="text-white" href="#"
                                                    role="button"
                                                    data-bs-toggle="dropdown"
                                                    aria-haspopup="true"
                                                    aria-expanded="false">
                                                    <h5 class="m-0">
                                                        <i
                                                            class="fas fa-info-circle ms-2"></i>
                                                    </h5>
                                                </a>
                                                <div
                                                    class="dropdown-menu dropdown-menu-dark bg-black dropdown-menu-end p-4 text-white-50 text-left bg-black">
                                                    <p>{{opt.info}}
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                        <div class="input-group">
                                            <input type="range"
                                                v-model="opt.val"
                                                class="slider form-control bg-darkg border-secondary text-info"
                                                :id="opt.id"
                                                :max="opt.range_high"
                                                :min="opt.range_low"
                                                :step="opt.step" />
                                            <span v-if="opt.unit"
                                                class="input-group-text bg-darkg border-secondary text-secondary">{{opt.unit}}</span>
                                        </div>
                                    </div>
                                    <div class="text-center mt-3">
                                        <button id="saveSettingsBtn"
                                            type="button"
                                            class="btn btn-primary mb-2"
                                            @click="saveNodeSettings()">
                                            Vote<i
                                                class="ms-2 fa-solid fa-check-to-slot"></i>
                                        </button>
                                        <p class="small">Your
                                            vote cannot be
                                            changed or
                                            cancelled once
                                            submitted.</p>
                                    </div>
                                    <div class="text-start">
                                        <p class="lead mb-1 text-center">
                                            VOTE POWER (VP)</p>
                                        <div class="progress mb-2"
                                            role="progressbar"
                                            aria-label="Vote Power"
                                            aria-valuenow="75" aria-valuemin="0"
                                            aria-valuemax="100">
                                            <div class="progress-bar"
                                                style="width: 75%">
                                                75%
                                            </div>
                                        </div>
                                        <ul class="small">
                                            <li>Recharge rate:
                                                14 days</li>
                                            <li>Voting will
                                                drain VP to 0%
                                            </li>
                                            <li>Full Recharge:
                                                {{formatNumber((spkStats.spk_cycle_length * 4)/28800, '.', ',', 2)}}
                                                days</li>
                                        </ul>
                                    </div>
                                </form>
                            </li>     
                        </ul>
              </div>
              <div class="modal-footer"> <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button> <button type="button" class="btn btn-primary" @click="confirm" data-bs-dismiss="modal">Continue</button> </div>
          </div>
      </div>
  </div>
  <slot name="trigger"></slot>

</div>`,
  methods: {
    log(event, item) {
      console.log(event, item)
    },
    fancyBytes(bytes) {
      var counter = 0, p = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
      while (bytes > 1024) {
        bytes = bytes / 1024
        counter++
      }
      return `${this.toFixed(bytes, 2)} ${p[counter]}B`
    },
    toFixed(num, dig) {
      return parseFloat(num).toFixed(dig);
    },
    valVote() {
      var op
      if (this.difVote) op = {
        type: "cja",
        cj: {
          votes: this.voteString,
        },
        id: `${this.spkprefix}T_val_vote`,
        msg: `Voting for Validators...`,
        ops: ["getSapi"],
        api: "https://spkinstant.hivehoneycomb.com",
        txid: "val_vote",
      };
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    accountCheck() {
      fetch("https://api.hive.blog", {
        body: `{\"jsonrpc\":\"2.0\", \"method\":\"condenser_api.get_accounts\", \"params\":[[\"${this.d.to}\"]], \"id\":1}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      })
        .then((r) => {
          return r.json();
        })
        .then((re) => {
          if (re.result.length) this.d.valid = true;
          else this.d.valid = false;
        });
    },
    isVal(node) {
      if (!node.self) return false
      return typeof node.val_code == 'string' ? true : false
    },
    isSelected(node) {
      for (var i = 0; i < this.d.valWorkable.length; i++) {
        if (this.d.valWorkable[i].self == node) return true
      }
      return false
    },
    add(node) {
      if (this.d.valWorkable.indexOf(node) == -1) this.d.valWorkable.push(node)
    },
    sub(node) {
      for (var i = 0; i < this.d.valWorkable.length; i++) {
        if (this.d.valWorkable[i].self == node.self) {
          this.d.valWorkable.splice(i, 1)
        }
      }
    },
    pick(evt, node, index) {
      evt.dataTransfer.dropEffect = 'move'
      evt.dataTransfer.effectAllowed = 'move'
      evt.dataTransfer.setData('itemID', index)
    },
    move(evt, node, index) {
      this.d.valWorkable.splice(index, 0, this.d.valWorkable.splice(evt.dataTransfer.getData('itemID'), 1)[0])
    },
    buildWorkVotes() {
      const arr = this.d.valvotes.split('')
      for (var i = 0; i < arr.length; i++) {
        this.d.workVotes.push(`${arr[i]}${arr[i + 1]}`)
        i++
      }
    },
    packageWorkVotes() {
      this.d.valvotes = this.d.workVotes.join('')
    },
    formatNumber(t, n, r, e) {
      if (typeof t != "number") t = parseFloat(t);
      if (isNaN(t)) return "0";
      if (!isFinite(t)) return (t < 0 ? "-" : "") + "infinite";
      (r = r || "."), (e = e || "");
      var u = t < 0;
      t = Math.abs(t);
      var a = (null != n && 0 <= n ? t.toFixed(n) : t.toString()).split("."),
        i = a[0],
        o = 1 < a.length ? r + a[1] : "";
      if (e)
        for (var c = /(\d+)(\d{3})/; c.test(i);)
          i = i.replace(c, "$1" + e + "$2");
      return (u ? "-" : "") + i + o;
    },
    confirm() {
      var op
      if (this.d.func == "powercancel") {
        if (this.d.token == "LARYNX")
          op = {
            type: "cja",
            cj: {
              amount: 0,
            },
            id: `${this.d.spkprefix}${this.d.test ? 'T' : ''}_power_down`,
            msg: `Canceling Power Down...`,
            ops: ["getSapi"],
            api: "https://spkinstant.hivehoneycomb.com",
            txid: "cancel power down",
          };
      } else if (this.d.func == "powercancel") {
        if (this.d.token == "LARYNX")
          op = {
            type: "cja",
            cj: {
              to: this.d.account,
              amount: 0,
            },
            id: `${this.d.spkprefix}${this.d.test ? 'T' : ''}_power_grant`,
            msg: `Canceling Power Down...`,
            ops: ["getSapi"],
            api: "https://spkinstant.hivehoneycomb.com",
            txid: "cancel power down",
          };
      }
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    build() {
      var op;
      if (this.d.ben_amount) {

      }
      op = {
        type: "cja",
        cj: {
          broca: this.d.amount,
          broker: this.d.broker,
          to: this.d.to,
          contract: "0",
        },
        id: `spkccT_channel_open`,
        msg: `Building Contract...`,
        ops: ["getSapi", "refreshComponents"],
        api: "https://spktest.dlux.io",
        txid: "build_contract",
      };
      if (this.d.ben_amount > 0 && this.d.ben_to) {
        op.cj.contract = "1"
        op.cj.slots = `${this.d.ben_to},${parseInt(this.d.ben_amount * 100)}`
      }
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    send() {
      var op;
      if (this.d.token == "DLUX")
        op = {
          type: "cja",
          cj: {
            to: this.d.to,
            amount: parseInt(this.d.amount * 1000),
            memo: this.d.memo,
          },
          id: `${this.d.token.toLowerCase()}_send`,
          msg: `Trying to send ${this.d.token}...`,
          ops: ["getTokenUser"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      else if (this.d.token == "SPK")
        op = {
          type: "cja",
          cj: {
            to: this.d.to,
            amount: parseInt(this.d.amount * 1000),
            memo: this.d.memo,
          },
          id: `${this.d.spkprefix}${this.d.test ? 'T' : ''}_spk_send`,
          msg: `Trying to send ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spkinstant.hivehoneycomb.com",
          txid: "send",
        };
      else if (this.d.token == "LARYNX")
        op = {
          type: "cja",
          cj: {
            to: this.d.to,
            amount: parseInt(this.d.amount * 1000),
            memo: this.d.memo,
          },
          id: `${this.d.spkprefix}${this.d.test ? 'T' : ''}_send`,
          msg: `Trying to send ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spkinstant.hivehoneycomb.com",
          txid: "send",
        };
      else if (this.d.token == "HIVE")
        op = {
          type: "xfr",
          cj: {
            to: this.d.to,
            hive: this.d.amount * 1000,
            memo: this.d.memo,
          },
          txid: "sendhive",
          msg: `Trying to send ${this.d.token}...`,
          ops: ["getHiveUser"],
        };
      else if (this.d.token == "HBD")
        op = {
          type: "xfr",
          cj: {
            to: this.d.to,
            hbd: this.d.amount * 1000,
            memo: this.d.memo,
          },
          txid: "sendhbd",
          msg: `Trying to send ${this.d.token}...`,
          ops: ["getHiveUser"],
        };
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    delegate() {
      var op;
      if (this.token == "DLUX")
        op = {
          type: "cja",
          cj: {
            to: this.to,
            amount: parseInt(this.amount * 1000),
          },
          id: `${this.token.toLowerCase()}_power_grant`,
          msg: `Trying to send ${this.token}...`,
          ops: ["getTokenUser"],
          api: "https://token.dlux.io",
          txid: "delegate",
        };
      else if (this.d.token == "LARYNX")
        op = {
          type: "cja",
          cj: {
            to: this.d.to,
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.spkprefix}${this.d.test ? 'T' : ''}_power_grant`,
          msg: `Trying to delegate ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spkinstant.hivehoneycomb.com",
          txid: "delegate",
        };
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    elect() {
      var op
      if (this.d.token == "SPK" && this.d.func == "Election")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000), //TODO
          },
          id: `${this.d.token.toLowerCase()}_val_vote`,
          msg: `Trying to unlock ${this.d.token}...`,
          ops: ["getTokenUser", "getSapi"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    vote() {
      var op
      if (this.d.token == "SPK" && this.d.func == "Election")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000), //TODO
          },
          id: `${this.d.token.toLowerCase()}_val_vote`,
          msg: `Trying to unlock ${this.d.token}...`,
          ops: ["getTokenUser", "getSapi"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    extend() {
      var op
      if (this.d.token == "BROCA")
        op = {
          type: "cja",
          cj: {
            broca: this.d.amount,
            id: this.d.contract.i,
            file_owner: this.d.contract.t,
            power: this.d.up ? 1 : 0,
          },
          id: `spkccT_extend`,
          msg: `Trying to unlock ${this.d.token}...`,
          ops: ["getTokenUser"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      if (op) {
        this.$emit("modalsign", op);
      }
    },
    power() {
      var op;
      if (this.d.token == "DLUX" && this.d.func == "Power Up")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.token.toLowerCase()}_power_up`,
          msg: `Trying to power up ${this.d.token}...`,
          ops: ["getTokenUser"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      else if (this.d.token == "DLUX" && this.d.func == "Power Down")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.token.toLowerCase()}_power_down`,
          msg: `Trying to power down ${this.d.token}...`,
          ops: ["getTokenUser"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      else if (this.d.token == "LARYNX" && this.d.func == "Power Down")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `spkcc${this.d.test ? 'T' : ''}_power_down`,
          msg: `Trying to power down ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spkinstant.hivehoneycomb.com",
          txid: "send",
        };
      else if (this.d.token == "LARYNX" && this.d.func == "Register a Service")
        op = {
          type: "cja",
          cj: {
            amount: 2000,
            type: this.d.to,
            memo: this.d.memo,
            id: this.d.id,
            api: this.d.api,
          },
          id: `spkccT_register_service`,
          msg: `Trying to register a service...`,
          ops: ["getSapi"],
          api: "https://spktest.dlux.io",
          txid: "register_service",
        }
      else if (this.d.token == "LARYNX" && this.d.func == "Register a Service Type")
        op = {
          type: "cja",
          cj: {
            amount: 200000,
            type: this.d.api,
            Long_Name: this.d.id,
          },
          id: `spkccT_register_service_type`,
          msg: `Trying to register a service...`,
          ops: ["getSapi"],
          api: "https://spktest.dlux.io",
          txid: "register_service_type",
        }
      else if (this.d.token == "LARYNX" && this.d.func == "Register a Validator")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `spkccT_validator_burn`,
          msg: `Trying to build validator brand...`,
          ops: ["getSapi"],
          api: "https://spktest.dlux.io",
          txid: "validator_burn",
        }
      else if (this.d.token == "DLUX" && this.d.func == "Unlock")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.token.toLowerCase()}_gov_down`,
          msg: `Trying to unlock ${this.d.token}...`,
          ops: ["getTokenUser"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      else if (this.d.token == "DLUX" && this.d.func == "Lock")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.token.toLowerCase()}_gov_down`,
          msg: `Trying to lock ${this.d.token}...`,
          ops: ["getTokenUser"],
          api: "https://token.dlux.io",
          txid: "send",
        };
      else if (this.d.token == "SPK" && this.d.func == "Power Up")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000)
          },
          id: `spkccT_spk_up`,
          msg: `Trying to power up ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spktest.dlux.io",
          txid: "spk_power",
        };
      else if (this.d.token == "LARYNX" && this.d.func == "Power Up")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.spkprefix}_power_up`,
          msg: `Trying to power up ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spkinstant.hivehoneycomb.com",
          txid: "send",
        };
      else if (this.d.token == "LARYNX" && this.d.func == "Unlock")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.spkprefix}_gov_down`,
          msg: `Trying to unlock ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spkinstant.hivehoneycomb.com",
          txid: "send",
        };
      else if (this.d.token == "LARYNX" && this.d.func == "Lock Liquidity")
        op = {
          type: "cja",
          cj: {
            amount: parseInt(this.d.amount * 1000),
          },
          id: `${this.d.spkprefix}_gov_up`,
          msg: `Trying to lock ${this.d.token}...`,
          ops: ["getSapi"],
          api: "https://spkinstant.hivehoneycomb.com",
          txid: "send",
        };
      if (op) {
        this.$emit("modalsign", op);
      }
    },
  },
  emits: ["modalsign"],
  props: {
    content: {
      required: false,
      default: "",
    },
    stats: {
      default: function () {
        return {
          head_block: 0,
        };
      },
    },
    contract: {
      default: function () {
        return {};
      },
    },
    up: {
      default: 0,
    },
    valvotes: {
      default: ''
    },
    valWorkable: {
      default: function () {
        return [];
      }
    },
    trigger: {
      default: "click",
    },
    i: {
      default: -1,
    },
    id: {
      default: '',
    },
    dis: {
      default: false,
    },
    ipfsproviders: {
      default: function () {
        return {
          "na": "na",
        };
      },
    },
    smarkets: {
      default: function () {
        return {
          na: {
            self: "",
          },
        };
      },
    },
    delay: {
      default: 0,
    },
    html: {
      default: false,
    },
    type: {
      default: "send",
    },
    func: {
      default: "Power Up",
    },
    account: {
      default: "Not Logged In",
    },
    current: {
      default: '',
    },
    token: {
      default: "Dlux",
    },
    to: {
      default: "",
    },
    memo: {
      default: "",
    },
    min: {
      default: "0.001",
    },
    max: {
      default: "",
    },
    balance: {
      default: 0,
    },
    amount: {
      default: 100,
    },
    ben_amount: {
      default: "10.00",
    },
    broker: {
      default: "",
    },
    ben_to: {
      default: '',
    },
    api: {
      default: 'https://ipfs.example.com',
    },
    test: {
      default: false,
    },
    customClass: {
      default: "",
    },
    html: {
      default: true,
    },
  },
  watch: {
    current: {
      handler: function (val, oldVal) {
        console.log('current')
        if (val != oldVal) {
          if (typeof this.current != 'string') return
          var smart = false
          for (var node in this.smarkets) {
            if (this.smarkets[node]?.val_code) {
              this.valCodeDict[this.smarkets[node].val_code] = this.smarkets[node]
              smart = true
            }
          }
          smart = (smart && this.current.indexOf(',') > -1) ? true : false
          const current = this.current.split(',')[1]
          if (smart) for (var i = 0; i < current.length; i++) {
            console.log(i, current.substr(i, 2), this.valCodeDict[current.substr(i, 2)])
            this.add(this.valCodeDict[current.substr(i, 2)])
            i++
          }
        }
      },
      deep: true,
    },
  },
  smarkets: {
    handler: function (val, oldVal) {
      console.log('smarkets')
      if (val != oldVal) {
        if (typeof this.current != 'string') return
        var smart = false
        for (var node in this.smarkets) {
          if (this.smarkets[node]?.val_code) {
            this.valCodeDict[this.smarkets[node].val_code] = this.smarkets[node]
            smart = true
          }
        }
        smart = (smart && this.current.indexOf(',') > -1) ? true : false
        console.log(this.current)
        const current = this.current.split(',')[1]
        if (smart) for (var i = 0; i < current.length; i++) {
          console.log(i, current.substr(i, 2), this.valCodeDict[current.substr(i, 2)])
          this.add(this.valCodeDict[current.substr(i, 2)])
          i++
        }
      }
    },
    deep: true,
  },
  computed: {
    difVote: {
      get() {
        return ((typeof this.current == 'string' ? this.current.split(',')[1] : '') == this.voteString) ? false : true
      }
    },
    voteString: {
      get() {
        return this.d.valWorkable.length > 0 ? this.d.valWorkable.map(v => v.val_code).join('') : ''
      }
    }
  },
  mounted() {
    var options = this.$props;
    const props = Object.keys(options);
    for (var i = 0; i < props.length; i++) {
      this.d[props[i]] = options[props[i]];
    }
    this.d.to = this.account
    if (typeof this.current == 'string') {
      var smart = false
      for (var node in this.smarkets) {
        if (this.smarkets[node]?.val_code) {
          this.valCodeDict[this.smarkets[node].val_code] = this.smarkets[node]
          smart = true
        }
      }
      smart = (smart && this.current.indexOf(',') > -1) ? true : false
      const current = this.current.split(',')[1]
      if (smart) for (var i = 0; i < current.length; i++) {
        console.log(i, current.substr(i, 2), this.valCodeDict[current.substr(i, 2)])
        this.add(this.valCodeDict[current.substr(i, 2)])
        i++
      }
    }
    if (!this.$slots["trigger"]) {
      //console.log(options)
    } else {
      //sellect the trigger class
      var trigger = this.$el.getElementsByClassName("trigger")[0];
      var target = this.$el.children[options.type];
      document.getElementById("app").appendChild(target);
      trigger.addEventListener("click", () => {
        var theModal = new Modal(target, () => { });
        theModal.show();
      });
    }
  },
};