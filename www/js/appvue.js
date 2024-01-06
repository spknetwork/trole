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
      newContracts: [],
      feed: {},
      lastFeed: 0,
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
      fetch(`https://spktest.dlux.io/feed/${since}`).then(res => res.json()).then(r => {
        var feedKeys = Object.keys(r.feed)
        for (let i = 0; i < feedKeys.length; i++) {
          const key = feedKeys[i].split(":")[0]
          if (this.feed[key] > since) {
            this.feed[feedKeys[i]] = r.feed[feedKeys[i]]
            if(r.feed[feedKeys[i]].indexOf(" bundled") > -1){
              this.newContracts.push(r.feed[feedKeys[i]].split(" bundled")[0])
            }
          }
          if (i == feedKeys.length - 1) {
            this.lastFeed = parseInt(key)
          }
        }
        this.newContracts = [... new Set(this.newContracts)]
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
