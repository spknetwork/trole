const { Modal } = bootstrap;

export default {
  name: "VoteParams",
  data() {
    return {
    };
  },
  template: `
<div>

<!-- Extend -->
<div class="modal fade" id="extend" :tabindex="i" role="dialog" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" role="document">
    <div class="modal-content bg-darker text-white">
        <div class="modal-header">
            <h5 class="modal-title"></h5> 
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <form name="sendhive">
            <div class="modal-body text-start"> 
              
            </div>
            <div class="modal-footer"> 
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button> 
              <button type="submit" class="btn btn-primary"  data-bs-dismiss="modal">Extend</button> 
            </div>
        </form>
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
    }
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
  
  mounted() {
    var options = this.$props;
    const props = Object.keys(options);
    for (var i = 0; i < props.length; i++) {
      this.d[props[i]] = options[props[i]];
    }
    this.d.to = this.account
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