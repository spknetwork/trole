const { Toast } = bootstrap;

export default {
  data() {
    return {
      toast: "",
    };
  },
  template: `
  <div ref="toast" class="toast bg-black border-info my-2" :data-bs-delay="alert.delay" role="alert" aria-live="assertive" aria-atomic="true" >
            <div class="toast-header bg-info">
              <strong class="me-auto text-dark">{{alert.title}}</strong>
              <small class="text-dark">{{elaspedTime(alert.time)}}</small>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" @click="removeOp(alert.txid)" aria-label="Close"></button>
            </div>
            <div class="toast-body text-white">{{alert.status}}</div>
            <div class="toast-body text-white" v-if="alert.link">
                <a :href="alert.link" target="_blank">View Hive TX</a>
            </div>
            <div class="toast-body text-white">{{alert.msg}}</div>
        </div>
        `,
  props: ["alert"],
  watch: {
    alert(newVal, oldVal) {
      console.log("Watcher");
      this.toast.show();
    },
  },
  mounted() {
    this.toast = new Toast(this.$refs.toast);
    this.toast.show();
  },
  methods: {
    removeOp(txid){
      var pend = JSON.parse(localStorage.getItem("pending"))
      for (var i = 0; i < pend.length; i++){
        if(pend[i].txid == txid){
          pend.splice(i,1)
          i--
        }
      }
      localStorage.setItem('pending', JSON.stringify(pend))
    },
    elaspedTime() {
      var time = new Date();
      var diff = time.getTime() - this.alert.time;
      var seconds = Math.floor(diff / 1000);
      var minutes = Math.floor(seconds / 60);
      var hours = Math.floor(minutes / 60);
      var days = Math.floor(hours / 24);
      var months = Math.floor(days / 30);
      var years = Math.floor(months / 12);
      if (seconds < 60) {
        return seconds + ` second${seconds > 1 ? "s" : ""} ago`;
      } else if (minutes < 60) {
        return minutes + ` minute${minutes > 1 ? "s" : ""} ago`;
      } else if (hours < 24) {
        return hours + ` hour${hours > 1 ? "s" : ""} ago`;
      } else if (days < 30) {
        return days + ` day${days > 1 ? "s" : ""} ago`;
      } else if (months < 12) {
        return months + ` month${months > 1 ? "s" : ""} ago`;
      } else {
        return years + ` year${years > 1 ? "s" : ""} ago`;
      }
    },
  },
};
