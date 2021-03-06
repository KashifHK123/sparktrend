/*!

=========================================================
* Vue Argon Design System - v1.1.0
=========================================================

* Product Page: https://www.creative-tim.com/product/argon-design-system
* Copyright 2019 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/argon-design-system/blob/master/LICENSE.md)

* Coded by www.creative-tim.com

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import Vue from "vue";
import App from "./App.vue";
import { router } from "./router";
import Argon from "./plugins/argon-kit";
import vSelect from "vue-select";
import VueI18n from "vue-i18n";
import './registerServiceWorker'
import messages from './i18n';
import { store } from './store';
import Pagniate from 'vuejs-paginate'
// import VueToastr2 from 'vue-toastr-2';
// import 'vue-toastr-2/dist/vue-toastr-2.min.css'
import VueSweetalert2 from "vue-sweetalert2";
import 'sweetalert2/dist/sweetalert2.min.css'
import { getLocale } from "./services/lang.service";

Vue.config.productionTip = false;
Vue.use(Argon);
Vue.use(VueI18n);
Vue.use(VueSweetalert2)
// window.toastr = require("toastr");
// Vue.use(VueToastr2);

const i18n = new VueI18n({
  locale: getLocale(),
  fallbackLocale: 'en',
  silentFallbackWarn: true,
  messages
});


Vue.component('v-select', vSelect);
Vue.component('paginate', Pagniate)
Vue.mixin({
  methods: {
    isEmpty(str){
      if(str instanceof Object){
        return Object.keys(str).length === 0 && str.constructor === Object;
      }
      return str === null || str === undefined || str === false || str === "";
    }
  }
});
new Vue({
  router,
  store,
  i18n,
  render: h => h(App)
}).$mount("#app");
