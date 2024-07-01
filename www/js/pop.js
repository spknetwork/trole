const { Popover } = bootstrap;

export default {
  template: `<div :id="id"><slot></slot></div>`,
  props: {
    content: {
      required: false,
      default: "",
    },
    id: {
      required: true,
      default: "",
    },
    title: {
      default: "My Popover",
    },
    trigger: {
      default: "click",
    },
    fa: {
      default: false,
    },
    delay: {
      default: 0,
    },
    html: {
      default: false,
    },
    template: {
      default:
        '<div class="popover" role="tooltip"><div class="popover-arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>',
    },
    customClass: {
      default: "",
    },
    html: {
      default: true,
    }
  },
  mounted() {
    // pass bootstrap popover options from props
    var options = this.$props;
    var ele = document.getElementById(this.id);
    new Popover(ele, options);
  },
};

