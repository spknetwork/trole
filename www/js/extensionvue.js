export default {
    template: `<div :id="'contract-' +  contract.id" class="d-flex flex-grow-1">
    <form id="contractForm" class="d-flex flex-column flex-grow-1 p-2 py-lg-3 px-lg-5">

     <!-- node banner -->
            <div v-if="hasStorage && !nodeview" :class="{'alert-success' : isStored, 'alert-danger' : !isStored}" class="alert d-flex align-items-center py-1 ps-2 pe-1 mx-2 mt-2 mb-1">
                <div class="me-1">{{isStored ? 'Your node is storing this contract' : 'Your node is not storing this contract'}}</div>
                <div class="ms-auto d-flex flex-wrap align-items-center justify-content-center mb-1">
                    <button style="max-width:100px;" type="button" class="flex-grow-1 btn btn-sm btn-warning ms-1 mt-1"
                        @click="">
                        <i class="fa-solid fa-flag fa-fw me-1"></i>Flag
                    </button>
                    <button style="max-width:100px;" type="button" @click="store(contract.i, isStored)"
                        class="flex-grow-1 ms-1 mt-1 btn btn-sm text-nowrap"
                        :class="{'btn-success': !isStored, 'btn-danger': isStored}">
                        <span v-if="!isStored"><i class="fa-solid fa-square-plus fa-fw me-1"></i>Add</span>
                        <span v-if="isStored"><i class="fa-solid fa-trash-can fa-fw me-1"></i>Remove</span>
                    </button>
                    
                </div>
            </div>

        <div class="d-flex flex-grow-1">

            <!-- detail banner -->
            <div class="d-flex d-none flex-column mb-2">
                <div class="w-100 py-1">
                    <div class="d-flex justify-content-between align-items-center mx-2">
                        <span class="text-break">{{fancyBytes(contract.u)}} | {{expIn(contract)}}</span>
                        <button type="button" class="btn btn-sm btn-outline-success" data-bs-toggle="collapse"
                            :data-bs-target="'#nodes-' + contract.id">
                            <i
                                class="fa-solid fa-tower-broadcast fa-fw me-1"></i>{{contract.nt}}/{{contract.p}}</button>
                    </div>
                    <div class="collapse mx-2" :id="'nodes-' + contract.id">
                        <div class="text-lead text-uppercase text-white-50 pb-05 mt-1 border-bottom">Nodes Storing This
                            Contract</div>
                        <ol type="1" class="my-1">
                            <div v-for="(acc, prop, index) in contract.n">
                                <li><a :href="'/@' + acc " class="no-decoration text-info">@{{acc}}</a></li>
                                <div v-if="index == Object.keys(contract.n).length - 1 && index + 1 < contract.p"
                                    v-for="i in (contract.p - (index + 1))">
                                    <li>Open</li>
                                </div>
                                <p class="d-none"
                                    v-if="index == Object.keys(contract.n).length - 1 && index + 1 < contract.p">
                                    {{contract.p - (index + 1) }} slots are open!</p>
                            </div>
                        </ol>

                    </div>
                </div>
            </div>

           

            <div class="d-flex flex-grow-1 flex-wrap justify-content-around">

                <div class="d-flex m-2 flex-column">
                    
                    <!-- storage nodes -->
                    <div class="d-flex flex-column justify-content-around px-2 mb-2" style="max-width: 300px">
                        <div class=" mx-2">
                            <div class="text-lead text-uppercase text-white-50 text-center pb-05 mt-2 border-bottom">Storage Nodes</div>
                            <ol type="1" class="my-1">
                                <div v-for="(acc, prop, index) in contract.n">
                                    <li><a :href="'/@' + acc " class="no-decoration text-info">@{{acc}}</a></li>
                                    <div v-if="index == Object.keys(contract.n).length - 1 && index + 1 < contract.p"
                                        v-for="i in (contract.p - (index + 1))">
                                        <li>Open</li>
                                    </div>
                                    <p class="d-none"
                                        v-if="index == Object.keys(contract.n).length - 1 && index + 1 < contract.p">
                                        {{contract.p - (index + 1) }} slots are open!</p>
                                </div>
                            </ol>
                        </div>
                        <div v-if="hasStorage" class="mx-auto mt-auto d-flex flex-wrap align-items-center justify-content-center mb-1">

                            <button style="max-width:100px;" @click="store(contract.i, isStored)" type="button"
                                class="d-none flex-grow-1 ms-1 mt-1 btn btn-sm text-nowrap"
                                :class="{'btn-success': !isStored, 'btn-danger': isStored}">
                                <span v-if="!isStored"><i class="fa-solid fa-square-plus fa-fw me-1"></i>Store</span>
                                <span v-if="isStored"><i class="fa-solid fa-trash-can fa-fw me-1"></i>Delete</span>
                            </button>
                            <button style="max-width:100px;" type="button" class="d-none flex-grow-1 btn btn-sm btn-warning ms-1 mt-1"
                                @click="" >
                                <i class="fa-solid fa-flag fa-fw me-1"></i>Flag</button>
                        </div>
                        <button type="button" class="d-none mx-auto mt-auto btn btn-sm btn-danger mt-1" v-if="contract.t == spkapi.name"
                            @click="cancel_contract(contract)">
                            <i class="fa-solid fa-file-circle-xmark fa-fw me-1"></i>Sever</button>
                    </div>
                </div>

                <!-- extend time input -->
                <div class="d-flex m-2 flex-column justify-content-around" style="max-width: 300px">
            
                
                    <!-- selector -->
                    <div class="btn-group me-auto mt-1">
                        <input name="time" v-model="contract.extend" @change="customTime = false;updateCost(contract.i)" title="1 Day"
                            class="btn-check" :id="'option1-' + contract.i" type="radio" value="1"
                            checked>
                        <label class="btn btn-sm btn-outline-info" :for="'option1-' + contract.i">1D</label>
                        <input name="time" v-model="contract.extend" @change="customTime = false;updateCost(contract.i)" title="1 Week"
                            class="btn-check" :id="'option2-' + contract.i" type="radio" value="7"
                        >
                        <label class="btn btn-sm btn-outline-info" :for="'option2-' + contract.i">1W</label>
                        <input name="time" v-model="contract.extend" @change="customTime = false;updateCost(contract.i)" title="1 Month"
                            class="btn-check" :id="'option3-' + contract.i" type="radio" value="30"
                        >
                        <label class="btn btn-sm btn-outline-info" :for="'option3-' + contract.i">1M</label>
                        <input name="time" v-model="contract.extend" @change="customTime = false;updateCost(contract.i)" title="1 Year"
                            class="btn-check" :id="'option4-' + contract.i" type="radio" value="365"
                        >
                        <label class="btn btn-sm btn-outline-info" :for="'option4-' + contract.i">1Y</label>
                    </div>
                
                

                    <!-- input -->
                    <div class=" mt-1">
                        <div class="position-relative">
                            <input type="number" step="1" min="1" class="pe-4 form-control btn-sm text-start border-info text-info"
                                v-model="contract.extend" @change="updateCost(contract.i)" style="min-width: 60px;" placeholder="0">
                                <span class="position-absolute text-info me-1 end-0 top-50 translate-middle-y">
                                Day<span v-if="contract.extend != 1">s</span>
                            </span>
                        </div>
                    </div>
                
                    <!-- add node button-->
                    <div class="d-flex align-items-center text-wrap ms-auto mt-1 btn btn-sm btn-outline-info p-0">
                        <label :for="'spread-' + contract.i" role="button" class="ps-1">&nbsp;</label>
                        <input class="form control" :id="'spread-' + contract.i" type="checkbox" role="button"
                            v-model="spread" @change="updateCost(contract.i)">
                        <label :for="'spread-' + contract.i" role="button" class="px-1 py-05">Add Node<i
                            class="d-none fa-solid fa-tower-broadcast fa-fw ms-1"></i></label>
                    </div>

                    <!-- cost -->
                    <div class="ms-auto d-flex align-items-center my-2 text-white fw-bold display-6">{{formatNumber(extendcost, 0, '.',',')}}
                        <span class="ms-2 fs-6 border-bottom border-2 border-white">BROCA<i class="fa-solid fa-atom ms-1"></i></span>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary mx-auto mt-1"
                        :disabled="extendcost > broca_calc(saccountapi.broca) || formatNumber(extendcost) < 1" @click="extend(contract)">
                        <i class="fa-solid fa-clock-rotate-left fa-fw me-1"></i>Extend
                    </button>

                </div>
            </div>
            <!-- action buttons -->
            <div class="px-2 mb-2 d-none d-flex justify-content-between flex-wrap text-wrap align-items-center text-white-50">
                <button type="button" class="d-none btn btn-sm btn-secondary mt-1" data-bs-toggle="collapse"
                    :data-bs-target="'#contract-' + contract.id">
                    <i class="fa-solid fa-xmark fa-fw me-1"></i>Cancel</button>
                <button type="button" class="btn btn-sm btn-danger mt-1" v-if="contract.t != account"
                    @click="cancel_contract(contract)">
                    <i class="fa-solid fa-file-circle-xmark fa-fw me-1"></i>Sever</button>
                <button type="button" class="btn btn-sm btn-primary mt-1"
                    v-if="extendcost > broca_calc(saccountapi.broca) || extendcost < 1" @click="extend(contract)">
                    <i class="fa-solid fa-clock-rotate-left fa-fw me-1"></i>Extend</button>
            </div>

        </div>
    </form>
</div>`,
    props: {
        contract: {
            required: true,
            default: function () {
                return {
                    n: {
                        "dlux-io": 1,
                    },
                    p: 3,
                    nt: "1",
                    i: "a:1:1",
                    id: "a-1-1",
                    u: 1,
                    t: 10,
                    extend: 7,

                };
            },
        },
        account: {
            default: ''
        },
        saccountapi: {
            required: true,
            default: function () {
                return {
                    head_block: 8000000
                };
            },
        },
        spkapi: {
            required: false,
            default: function () {
                return {
                    name: "Guest",
                    storage: {}
                };
            },
        },
        sstats: {
            required: true,
            default: function () {
                return {
                    head_block: 8000000
                };
            },
        },
        nodeview: {
            default: false
        },
    },
    data() {
        return {
            collapse: false,
            edit: false,
            view: true,
            mde: '',
            makeReply: false,
            warn: false,
            flag: false,
            slider: 10000,
            spread: false,
            showNodes: false,
            bens: [],
            extendcost: 0,
        };
    },
    emits: ['tosign'],
    methods: {
        store(contract, remove = false){
            // have a storage node?
            const toSign = {
                type: "cja",
                cj: {
                  items: [contract]
                },
                id: `spkccT_${!remove ? 'store' : 'remove'}`,
                msg: `Storing ${contract}...`,
                ops: ["getTokenUser"],
                api: "https://spktest.dlux.io",
                txid: `${contract}_${!remove ? 'store' : 'remove'}`,
              }
              this.$emit('tosign', toSign)
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
        broca_calc(last = '0,0') {
            const last_calc = this.Base64toNumber(last.split(',')[1])
            const accured = parseInt((parseFloat(this.sstats.broca_refill) * (this.sstats.head_block - last_calc)) / (this.saccountapi.spk_power * 1000))
            var total = parseInt(last.split(',')[0]) + accured
            if (total > (this.saccountapi.spk_power * 1000)) total = (this.saccountapi.spk_power * 1000)
            return total
        },
        formatNumber(t, n, r, e) {
            if (typeof t != "number") {
                const parts = t.split(" ");
                var maybe = 0
                for (i = 0; i < parts.length; i++) {
                if (parseFloat(parts[i])>0){
                    maybe += parseFloat(parts[i])
                }
                }
                if (maybe>parseFloat(t)){
                t = maybe
                } else {
                t = parseFloat(t)
                }
            }
            if (isNaN(t)) return "0";
            if (!isFinite(t)) return (t < 0 ? "-" : "") + "infinite";
            (r = r || "."), (e = e || "");
            var u = t < 0;
            t = Math.abs(t);
            var a = (null != n && 0 <= n ? t.toFixed(n) : t.toString()).split("."),
                i = a[0],
                o = 1 < a.length ? r + a[1] : "";
            if (e)
                for (var c = /(\d+)(\d{3})/; c.test(i); )
                i = i.replace(c, "$1" + e + "$2");
            return (u ? "-" : "") + i + o;
        },
        updateCost(){
            this.extendcost = parseInt((parseInt(this.contract.extend) / 30) * parseInt(this.contract.r) * ((this.contract.p + (this.spread ? 1 : 0))/this.contract.p))
            if(this.extendcost > this.broca_calc(this.broca)) this.extendcost = this.broca_calc(this.broca)
            if(this.extendcost < 1 || typeof this.extendcost != "number") this.extendcost = 1
            this.$forceUpdate()
          },
        fancyBytes(bytes){
            var counter = 0, p = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
            while (bytes > 1024){
              bytes = bytes / 1024
              counter ++
            }
            return `${this.toFixed(bytes, 2)} ${p[counter]}B`
          },
          toFixed(num, dig){
            return parseFloat(num).toFixed(dig);
          },
          expIn(con){
            if(con.e)return `Expires in ${parseInt((parseInt(con.e.split(':')[0]) - this.sstats.head_block) / 20 / 60) < 24 ? parseInt((parseInt(con.e.split(':')[0]) - this.saccountapi.head_block) / 20 / 60) + ' hours' : parseInt((parseInt(con.e.split(':')[0]) - this.saccountapi.head_block) / 20 / 60 / 24) + ' days'}`
          },
          extend(contract, amount = this.extendcost){
            if(amount > this.broca_calc(this.broca))return
            const toSign = {
                type: "cja",
                cj: {
                  broca: amount,
                  id: contract.i,
                  file_owner: contract.t,
                  power: this.spread ? 1 : 0,
                },
                id: `spkccT_extend`,
                msg: `Extending ${contract.i}...`,
                ops: ["getTokenUser"],
                api: "https://spktest.dlux.io",
                txid: "extend",
              }
              this.$emit('tosign', toSign)
        },
        cancel_contract(contract){
            //if(this.account != contract.t)return
            const toSign = {
                type: "cja",
                cj: {
                  id: contract.i,
                },
                id: `spkccT_contract_close`,
                msg: `Canceling ${contract.i}...`,
                ops: ["getTokenUser", "getSapi"],
                api: "https://spktest.dlux.io",
                txid: "cancel_contract",
              }
              this.$emit('tosign', toSign)
        }
    },
    computed: {
        isStored: {
          get() {
            var found = false
            for (var i in this.contract.n) {
                if (this.contract.n[i] == this.spkapi.name) {
                    found = true
                    break
                }
            }
            return found
          },
        },
        hasStorage: {
            get() {
                if (typeof this.spkapi.storage == "string"){
                    return true
                } else return false
            },
        },
    },
    watch: {
        'contract'(newValue) {
            this.contract.id = this.contract.i.replace(/:/g, "-");
            this.contract.extend = 7
            this.updateCost()
        },
        // when contract.extend changes, run updateCost
        'contract.extend'(newValue) {
            this.updateCost()
        },
      },
    mounted() {
        this.contract.id = this.contract.i.replace(/:/g, "-");
        this.contract.extend = 7
        this.updateCost()
    },
};

