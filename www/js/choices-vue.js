export default {
  name: "Choices",
  template: `<select multiple id="select-tag" :ref="reference"></select>`,
  emits: ["data"],
  props: {
    reference: {
      type: String,
      default: "default"
    },
    prop_type: {
      type: String,
      default: "tags"
    },
    prop_selections: {
      default: ""
    },
    prop_function: {
      type: String,
      default: "Set"
    }
  },
  data() {
    return {
      opts: {
        silent: false,
        items: [],
        renderChoiceLimit: -1,
        maxItemCount: 7,
        addItems: true,
        addItemFilter: null,
        removeItems: true,
        removeItemButton: true,
        editItems: false,
        allowHTML: true,
        duplicateItemsAllowed: false,
        delimiter: ',',
        paste: true,
        searchEnabled: true,
        searchChoices: true,
        searchFloor: 1,
        searchResultLimit: 4,
        searchFields: ['label', 'value'],
        position: 'auto',
        resetScrollPosition: true,
        shouldSort: true,
        shouldSortItems: false,
        sorter: function (a, b) {
          return a.value - b.value;
        },
        placeholder: true,
        placeholderValue: 'Tags',
        searchPlaceholderValue: null,
        prependValue: null,
        appendValue: null,
        renderSelectedChoices: 'auto',
        loadingText: 'Loading...',
        noResultsText: 'No results found',
        noChoicesText: 'No choices to choose from',
        itemSelectText: 'Press to select',
        uniqueItemText: 'Only unique values can be added',
        customAddItemText: 'Only values matching specific conditions can be added',
        // callbackOnCreateTemplates: function (template) {
        //   console.log(template)
        // }
      },
      msg: "",
      Choices: null,
      tags: [{
        value: 4,
        label: 'NSFW',
        selected: false,
        disabled: false,
        customProperties: {
          description: 'Not Safe For Work'
        },
      }, {
        value: 8,
        label: 'Executable',
        selected: false,
        disabled: false,
        customProperties: {
          description: 'Is an executable file'
        },
      },
      //  {
      //   value: 16,
      //   label: 'Stock',
      //   selected: false,
      //   disabled: false,
      //   customProperties: {
      //     description: 'Smart License to allow commercial/other use'
      //   },
      // }
      ],
      license: [
      {
        value: "1",
        label: '<i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i>CC BY',
        selected: false,
        disabled: false,
        customProperties: {
          description: 'Creative Commons Attribution License',
          link: 'https://creativecommons.org/licenses/by/4.0/'
        },
      }, {
        value: "2",
        label: '<i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i><i class="fa-brands fa-creative-commons-sa"></i>CC BY-SA',
        selected: false,
        disabled: false,
        customProperties: {
          description: 'Creative Commons Share Alike License',
          link: 'https://creativecommons.org/licenses/by-sa/4.0/'
        },
      }, {
        value: "3",
        label: '<i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i><i class="fa-brands fa-creative-commons-nd"></i>CC BY-ND',
        selected: false,
        disabled: false,
        customProperties: {
          description: 'Creative Commons No Derivatives License',
          link: 'https://creativecommons.org/licenses/by-nd/4.0/'
        },
      }, {
        value: "4",
        label: '<i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i><i class="fa-brands fa-creative-commons-nc"></i><i class="fa-brands fa-creative-commons-nd"></i>CC BY-NC-ND',
        selected: false,
        disabled: false,
        customProperties: {
          description: 'Creative Commons Non-Commercial No Derivatives License',
          link: 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
        }
      }, {
          value: "5",
          label: '<i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i><i class="fa-brands fa-creative-commons-nc"></i>CC BY-NC',
          selected: false,
          disabled: false,
          customProperties: {
            description: 'Creative Commons Non-Commercial License',
            link: 'https://creativecommons.org/licenses/by-nc/4.0/'
          },
        }, {
          value: "6",
          label: '<i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i><i class="fa-brands fa-creative-commons-nc"></i><i class="fa-brands fa-creative-commons-sa"></i>CC BY-NC-SA',
          selected: false,
          disabled: false,
          customProperties: {
            description: 'Creative Commons Non-Commercial Share Alike License',
            link: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
          },
        },{
          value: "7",
          label: '<i class="fa-brands fa-creative-commons-zero"></i>CC0',
          selected: false,
          disabled: false,
          customProperties: {
            description: 'CC0: Public Domain Grant',
            link: 'https://creativecommons.org/publicdomain/zero/1.0/'
          },
        },
      ],
      labels: [{
        value: "0",
        label: '<i class="fa-solid fa-sink fa-fw me-1"></i>Miscellaneous',
        selected: false,
        disabled: false,
      },{
        value: "1",
        label: '<i class="fa-solid fa-exclamation fa-fw me-1"></i>Important',
        selected: false,
        disabled: false,
      }, {
        value: "2",
        label: '<i class="fa-solid fa-star fa-fw me-1"></i>Favorite',
        selected: false,
        disabled: false,
      }, {
        value: "3",
        label: '<i class="fa-solid fa-dice fa-fw me-1"></i>Random',
        selected: false,
        disabled: false,
      }, {
        value: "4",
        label: '<i class="fa-solid fa-circle fa-fw me-1 text-red"></i>Red',
        selected: false,
        disabled: false,
      }, {
        value: "5",
        label: '<i class="fa-solid fa-circle fa-fw me-1 text-orange"></i>Orange',
        selected: false,
        disabled: false,
      }, {
        value: "6",
        label: '<i class="fa-solid fa-circle fa-fw me-1 text-yellow"></i>Yellow',
        selected: false,
        disabled: false,
      }, {
        value: "7",
        label: '<i class="fa-solid fa-circle fa-fw me-1 text-green"></i>Green',
        selected: false,
        disabled: false,
      }, {
        value: "8",
        label: '<i class="fa-solid fa-circle fa-fw me-1 text-blue"></i>Blue',
        selected: false,
        disabled: false,
      }, {
        value: "9",
        label: '<i class="fa-solid fa-circle fa-fw me-1 text-purple"></i>Purple',
        selected: false,
        disabled: false,
      }, {
        value: "A",
        label: '<i class="fa-solid fa-circle fa-fw me-1 text-grey"></i>Grey',
        selected: false,
        disabled: false,
      }, {
        value: "B",
        label: '<i class="fa-solid fa-briefcase fa-fw me-1"></i>Work',
        selected: false,
        disabled: false,
      }, {
        value: "C",
        label: '<i class="fa-solid fa-heart fa-fw me-1"></i>Personal',
        selected: false,
        disabled: false,
      }, {
        value: "D",
        label: '<i class="fa-solid fa-people-roof fa-fw me-1"></i>Family',
        selected: false,
        disabled: false,
      }, {
        value: "E",
        label: '<i class="fa-solid fa-people-group fa-fw me-1"></i>Friends',
        selected: false,
        disabled: false,
      }, {
        value: "F",
        label: '<i class="fa-solid fa-rocket fa-fw me-1"></i>Projects',
        selected: false,
        disabled: false,
      }, {
        value: "G",
        label: '<i class="fa-solid fa-piggy-bank fa-fw me-1"></i>Finance',
        selected: false,
        disabled: false,
      }, {
        value: "H",
        label: '<i class="fa-solid fa-kit-medical fa-fw me-1"></i>Health',
        selected: false,
        disabled: false,
      }, {
        value: "I",
        label: '<i class="fa-solid fa-graduation-cap fa-fw me-1"></i>Education',
        selected: false,
        disabled: false,
      }, {
        value: "J",
        label: '<i class="fa-solid fa-compass fa-fw me-1"></i>Travel',
        selected: false,
        disabled: false,
      }, {
        value: "K",
        label: '<i class="fa-regular fa-calendar-days fa-fw me-1"></i>Events',
        selected: false,
        disabled: false,
      }, {
        value: "L",
        label: '<i class="fa-solid fa-camera fa-fw me-1"></i>Photography',
        selected: false,
        disabled: false,
      }, {
        value: "M",
        label: '<i class="fa-solid fa-gamepad fa-fw me-1"></i>Gaming',
        selected: false,
        disabled: false,
      }, {
        value: "N",
        label: '<i class="fa-solid fa-volleyball fa-fw me-1"></i>Sports',
        selected: false,
        disabled: false,
      }, {
        value: "O",
        label: '<i class="fa-solid fa-feather fa-fw me-1"></i>Blogging',
        selected: false,
        disabled: false,
      }, {
        value: "P",
        label: '<i class="fa-solid fa-crown fa-fw me-1"></i>Meme',
        selected: false,
        disabled: false,
      }, {
        value: "Q",
        label: '<i class="fa-solid fa-music fa-fw me-1"></i>Music',
        selected: false,
        disabled: false,
      }, {
        value: "R",
        label: '<i class="fa-solid fa-video fa-fw me-1"></i>Video',
        selected: false,
        disabled: false,
      }, {
        value: "S",
        label: '<i class="fa-solid fa-microphone fa-fw me-1"></i>Audio',
        selected: false,
        disabled: false,
      }, {
        value: "T",
        label: '<i class="fa-solid fa-newspaper fa-fw me-1"></i>News',
        selected: false,
        disabled: false,
      }, {
        value: "U",
        label: '<i class="fa-solid fa-code fa-fw me-1"></i>Development',
        selected: false,
        disabled: false,
      }, {
        value: "V",
        label: '<i class="fa-solid fa-hat-cowboy fa-fw me-1"></i>Fashion',
        selected: false,
        disabled: false,
      }, {
        value: "W",
        label: '<i class="fa-solid fa-burger fa-fw me-1"></i>Food',
        selected: false,
        disabled: false,
      }, {
        value: "X",
        label: '<i class="fa-solid fa-utensils fa-fw me-1"></i>Cooking',
        selected: false,
        disabled: false,
      }, {
        value: "Y",
        label: '<i class="fa-solid fa-toolbox fa-fw me-1"></i>DIY',
        selected: false,
        disabled: false,
      }, {
        value: "Z",
        label: '<i class="fa-solid fa-paintbrush fa-fw me-1"></i>Art',
        selected: false,
        disabled: false,
      }, {
        value: "a",
        label: '<i class="fa-solid fa-swatchbook fa-fw me-1"></i>Design',
        selected: false,
        disabled: false,
      }, {
        value: "b",
        label: '<i class="fa-solid fa-microchip fa-fw me-1"></i>Technology',
        selected: false,
        disabled: false,
      }, {
        value: "c",
        label: '<i class="fa-solid fa-cross fa-fw me-1"></i>Religion',
        selected: false,
        disabled: false,
      }, {
        value: "d",
        label: '<i class="fa-solid fa-scale-balanced fa-fw me-1"></i>Government',
        selected: false,
        disabled: false,
      }, {
        value: "e",
        label: '<i class="fa-solid fa-landmark-dome fa-fw me-1"></i>Politics',
        selected: false,
        disabled: false,
      }, {
        value: "f",
        label: '<i class="fa-solid fa-vial fa-fw me-1"></i>Science',
        selected: false,
        disabled: false,
      }, {
        value: "g",
        label: '<i class="fa-solid fa-magnifying-glass fa-fw me-1"></i>Research',
        selected: false,
        disabled: false,
      }, {
        value: "h",
        label: '<i class="fa-solid fa-receipt fa-fw me-1"></i>Receipts',
        selected: false,
        disabled: false,
      }, {
        value: "i",
        label: '<i class="fa-solid fa-envelope-open-text fa-fw me-1"></i>Correspondence',
        selected: false,
        disabled: false,
      }, {
        value: "j",
        label: '<i class="fa-solid fa-copy fa-fw me-1"></i>Templates',
        selected: false,
        disabled: false,
      }, {
        value: "k",
        label: '<i class="fa-solid fa-file-lines fa-fw me-1"></i>Resources',
        selected: false,
        disabled: false,
      }, {
        value: "l",
        label: '<i class="fa-solid fa-book-bookmark fa-fw me-1"></i>Reference',
        selected: false,
        disabled: false,
      }, {
        value: "m",
        label: '<i class="fa-solid fa-floppy-disk fa-fw me-1"></i>Backups',
        selected: false,
        disabled: false,
      }, {
        value: "n",
        label: '<i class="fa-solid fa-box-archive fa-fw me-1"></i>Archive',
        selected: false,
        disabled: false,
      }, {
        value: "o",
        label: '<i class="fa-solid fa-compass-drafting fa-fw me-1"></i>Drafts',
        selected: false,
        disabled: false,
      }, {
        value: "p",
        label: '<i class="fa-solid fa-flag-checkered fa-fw me-1"></i>Finished',
        selected: false,
        disabled: false,
      }, {
        value: "q",
        label: '<i class="fa-solid fa-paper-plane fa-fw me-1"></i>Sent',
        selected: false,
        disabled: false,
      }, {
        value: "r",
        label: '<i class="fa-solid fa-clock fa-fw me-1"></i>Pending',
        selected: false,
        disabled: false,
      }, {
        value: "s",
        label: '<i class="fa-solid fa-thumbs-up fa-fw me-1"></i>Approved',
        selected: false,
        disabled: false,
      }, {
        value: "t",
        label: '<i class="fa-solid fa-thumbs-down fa-fw me-1"></i>Rejected',
        selected: false,
        disabled: false,
      }, {
        value: "u",
        label: '<i class="fa-solid fa-lightbulb fa-fw me-1"></i>Ideas',
        selected: false,
        disabled: false,
      }, {
        value: "v",
        label: '<i class="fa-solid fa-bullseye fa-fw me-1"></i>Goals',
        selected: false,
        disabled: false,
      }, {
        value: "w",
        label: '<i class="fa-solid fa-list-check fa-fw me-1"></i>Tasks',
        selected: false,
        disabled: false,
      }, {
        value: "x",
        label: '<i class="fa-solid fa-gavel fa-fw me-1"></i>Legal',
        selected: false,
        disabled: false,
      }, {
        value: "y",
        label: '<i class="fa-solid fa-handshake fa-fw me-1"></i>Networking',
        selected: false,
        disabled: false,
      }, {
        value: "z",
        label: '<i class="fa-solid fa-comments fa-fw me-1"></i>Feedback',
        selected: false,
        disabled: false,
      }, {
        value: "+",
        label: '<i class="fa-solid fa-square-poll-vertical fa-fw me-1"></i>Surveys',
        selected: false,
        disabled: false,
      }, {
        value: "=",
        label: '<i class="fa-solid fa-user-secret fa-fw me-1"></i>Classified',
        selected: false,
        disabled: false,
      }
      ],
      selections: []
    }
  },
  methods: {
    Base64toNumber(chars = "") {
      const glyphs =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
      var result = 0;
      chars = chars.split("");
      for (var e = 0; e < chars.length; e++) {
        result = result * 64 + glyphs.indexOf(chars[e]);
      }
      return result;
    },
    passData(d) {
      this.$emit("data", template)
    },
    init() {
      if(this.prop_type == 'tags') {
        const num = this.Base64toNumber(this.prop_selections[0])
        //if(num & 2) this.selections.push(this.tags[0])
        if(num & 4) this.selections.push(this.tags[0])
        if(num & 8) this.selections.push(this.tags[1])
      } else if (this.prop_type == 'license') {
        const index = this.Base64toNumber(this.prop_selections)
        if(index && index <= this.license.length)this.selections.push(this.license[index - 1])
      } else {
        for (var i = 0; i < this.prop_selections.length; i++) {
          this.selections.push(this.labels[this.Base64toNumber(this.prop_selections[i])])
        }
      }

    },
    setUp() {
      this.init()
      var opts = this.opts
      opts.choices = this[this.prop_type]
      opts.maxItemCount = this.prop_function == "search" ? -1 : 7
      if(this.prop_type == 'license') {
        opts.maxItemCount = 1
      }
      opts.placeholderValue = this.prop_type.charAt(0).toUpperCase() + this.prop_type.slice(1)
      if (!Choices) this.msg = 'Choices not loaded'
      else if (this.reference == '') this.msg = 'Ref not set'
      else {

        this.Choices = new Choices(this.$refs[this.reference], opts).setValue(this.selections)
        this.$refs[this.reference].addEventListener('addItem', this.handleAdd);
        this.$refs[this.reference].addEventListener('removeItem', this.handleRemove);
      }
    },
    handleAdd(e) {
      const message = {
        item: e.detail.value,
        action: 'added'
      }
	    this.$emit('data', message);
    },
    handleRemove(e) {
      const message = {
        item: e.detail.value,
        action: 'removed'
      }
	    this.$emit('data', message);
    }
  },
  mounted() {
    this.setUp()
  }
}