export default {
    name: "MDE",
    template: `<div><textarea ref="mde"/></div>`,
    emits: ["data"],
    mounted() {
      this.mde = new SimpleMDE({ 
        element: this.$refs.mde,
        dragDrop: false });
      this.mde.codemirror.on("change", () => {
        this.$emit("data", this.mde.value())
      });
    }
  };