import Pop from "/js/pop.js";
import ExtensionVue from "/js/extensionvue.js";
import FilesVue from "/js/filesvue.js";
import UploadVue from "/js/uploadvue.js";
import ModalVue from "/js/modalvue.js";
import PostVue from "/js/postvue.js";
import ChoicesVue from '/js/choices-vue.js';


export default {
    components: {
        "pop-vue": Pop,
        "extension-vue": ExtensionVue,
        "files-vue": FilesVue,
        "upload-vue": UploadVue,
        "modal-vue": ModalVue,
        "post-vue": PostVue,
        "choices-vue": ChoicesVue
    },
    template: `
    <div class="d-flex flex-column">
    <div class="d-flex flex-grow-1 p-1" v-if="!nodeview">
        <div class="d-flex flex-grow-1 flex-wrap align-items-stretch justify-content-around">
            
            
            <div class="card m-1" style="width: 18rem;">
                <div class="card-header d-flex align-items-center justify-content-between px-2 py-1 fs-4"><i class="fa-solid fa-atom me-1"></i><span>SPK</span></div>
                <div class="card-body px-2 py-1">
                    <div class="d-flex flex-column">
                        <div class="mb-1 fw-light d-flex justify-content-center" style="font-size: 1.1rem !important;">{{formatNumber((saccountapi.spk/1000),'3','.',',')}} SPK</div>
                        <div class="d-flex justify-content-around mt-1">
                            <!-- spk wallet button -->
                            <button v-if="!nodeview" type="button" class="btn btn-sm btn-dark border-secondary text-secondary d-flex justify-content-center" data-bs-toggle="modal" data-bs-target="#spkWalletModal" style="width:110px;">
                                <i class="fa-solid fa-wallet fa-fw me-1 my-auto"></i>
                                <span class="my-auto">Wallet</span>
                                <span class="badge small text-bg-secondary text-black ms-1 mb-auto" style="font-size: 0.5em;">Test</span>
                            </button>
                            <modal-vue type="power" token="SPK" test="test"
                                    func="Power Up" :balance="saccountapi.spk"
                                    :account="account"
                                    @modalsign="sendIt($event)" v-slot:trigger>
                                    <button class="btn btn-sm btn-dark border-warning text-warning trigger"
                                        type="button" style="width:110px;"><i class="fa-solid fa-bolt fa-fw me-1"></i>Power Up</button>
                                </modal-vue>
                        </div>
                    </div>    
                </div>
            </div>
            
            
            <div class="card m-1" style="width: 18rem;">
                <div class="card-header d-flex align-items-center justify-content-between px-2 py-1 fs-4"><i class="fa-solid fa-bolt me-1"></i>
                <span class="d-flex align-items-center">Power</span></div>
                <div class="d-flex flex-column card-body px-2 py-1">
                    <div class="mb-1 fw-light text-center " style="font-size: 1.1rem !important;">{{formatNumber(saccountapi.spk_power/1000,'3','.',',')}} SPK Power</div>
                    <div class="progress mb-1 is-danger" role="progressbar" aria-label="Basic example" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" :style="{'width':  saccountapi.spk_power ? (broca_calc(saccountapi.broca)/(saccountapi.spk_power*1000))*100 + '%' : '0%' }">{{ formatNumber((broca_calc(saccountapi.broca)/(saccountapi.spk_power*1000))*100,'2','.',',') }}%</div>
                    </div>
                    <a href="#" data-bs-toggle="modal" data-bs-target="#buyTokenModal" class="text-center text-primary">Get more power</a>
                </div>
            </div>

            <div class="card m-1" style="width: 18rem;">
                <div class="card-header d-flex align-items-center justify-content-between px-2 py-1 fs-4"><i class="fa-solid fa-chart-pie me-1"></i><span>Storage</span></div>
                <div class="d-flex flex-column card-body px-2 py-1">
                    <div class="mb-1 fw-light text-center" style="font-size: 1.1rem !important;">{{fancyBytes(usedBytes)}} of {{fancyBytes(availableBytes)}} used</div>
                    <div class="progress mb-1" role="progressbar" aria-label="Basic example" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" :style="'width:' + (usedBytes/availableBytes)*100 + '%;'">{{formatNumber((usedBytes/availableBytes)*100,'2','.',',')}}%</div>
                    </div>
                    <a href="#" data-bs-toggle="modal" data-bs-target="#buyTokenModal" class="text-center text-primary">Get more storage</a>
                </div>
            </div>

            <div class="card m-1" style="width: 18rem;">
                <div class="card-header d-flex align-items-center justify-content-between px-2 py-1 fs-4"><i class="fa-solid fa-cloud-arrow-up me-1"></i><span>Upload</span></div>
                    <div class="card-body px-2 py-1">
                        <div class="d-flex flex-column">
                            <div class="mb-1 fw-light text-center" style="font-size: 1.1rem !important;">Open a contract to store files</div>
                            <div class="d-flex justify-content-around mt-1">
                                <!-- new contract button -->
                                <button v-if="saccountapi.pubKey != 'NA' && saccountapi.spk_power" type="button"
                                    class="btn btn-sm btn-dark border-info text-info" style="width:110px;">
                                    <modal-vue type="build" token="BROCA" :balance="broca_calc(saccountapi.broca)"
                                        :account="account" @modalsign="toSign=$event" :ipfsproviders="ipfsProviders"
                                        v-slot:trigger>
                                        <span slot="trigger" class="trigger"><i
                                                class="fa-solid fa-file-contract fa-fw me-1"></i>NEW</span>
                                    </modal-vue>
                                </button>
                                <!-- free button -->
                                <button v-if="saccountapi.pubKey != 'NA'" type="button" class="btn btn-sm btn-dark border-success text-success"
                                    data-bs-toggle="modal" data-bs-target="#sponsoredModal" style="width:110px;">
                                    <span class=""></span><i class="fa-solid fa-wand-magic-sparkles fa-fw me-1"></i>FREE
                                </button>
                                <!-- register -->
                                <button v-if="saccountapi.pubKey == 'NA'" type="button" class="btn btn-sm btn-dark border-info text-info"
                                    @click="updatePubkey()" style="width:110px;">
                                    <span class=""></span><i class="fa-solid fa-user-plus fa-fw me-1"></i>Register
                                </button>
                                  
                        </div>    
                    </div>    
                </div>
            </div>

        </div>
    </div>

    <!-- register account -->
    <div v-if="saccountapi.pubKey == 'NA'" class="d-flex justify-content-center">
        <div class="d-flex p-3 mt-3">
            <div class="text-center" style="max-width: 600px;">
                <p class="fs-4 lead">Register your account on SPK Network for free<br>to start storing your files on IPFS</p>
                <div class="d-flex justify-content-center">
                <button type="button" class="btn btn-primary my-3" @click="updatePubkey()">
                <i class="fa-solid fa-user-plus fa-fw me-1"></i> Register Account
                </button>
                
                </div>
            </div>
        </div>
    </div>

    <!-- tabs nav -->
    <div v-if="saccountapi.pubKey != 'NA'" class="d-flex flex-column card p-0"  >

        <!-- top menu -->
        <div class="pb-1">
            <div class="d-flex flex-wrap align-items-center mt-3">
                <div>
                    <button role="button" class="btn btn-danger mx-2 invisible"><i class="fa-solid fa-download fa-fw me-2"></i>Store All</button>
                </div>
                <div class="mx-auto ">
                    <ul class="nav nav-tabs rounded mx-auto fs-5 " style="background-color: rgb(0,0,0,0.3)">
                        <li class="nav-item">
                            <a class="nav-link active px-4" :href="'#contractsTab' + title" role="tab" data-bs-toggle="tab"
                                aria-controls="contractstab" aria-expanded="true">CONTRACTS</a>
                        </li>
                        <li v-if="!cc" class="nav-item">
                            <a class="nav-link px-4" aria-current="page" :href="'#filesTab' + title" role="tab" data-bs-toggle="tab"
                                aria-controls="filestab" aria-expanded="false">FILES</a>
                        </li>
                        <li v-if="cc" class="nav-item">
                            <a class="nav-link px-4" aria-current="page" href="#ccTab" role="tab" data-bs-toggle="tab"
                                aria-controls="cctab" aria-expanded="false">Files</a>
                        </li>
                    </ul>
                </div>
                <div>
                    <button role="button" class="btn btn-danger mx-1" :class="{'invisible': title != 'new'}"><i class="fa-solid fa-download fa-fw me-2"></i>Store Selected</button>
                    <button class="btn btn-primary mx-1" type="button" data-bs-toggle="collapse" data-bs-target="#storeOptions" aria-expanded="false" aria-controls="storeOptions">
                        Selection Options
                    </button>
                </div>
            </div>
        </div>
        <div class="collapse" id="storeOptions">
        <div class="d-flex">
            <div class="ms-auto card card-body" style="max-width: 200px">
            <div class="d-flex flex-column">
                    <div class="text-center mb-2">
                        <label for="fileSize" class="lead form-label">File Size</label>
                        <input required="required" type="range" class="form-range" min="0" max="7" step="1" value="3" id="fileSize">
                        <span>5 GB</span>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckChecked" checked>
                        <label class="form-check-label" for="flexSwitchCheckChecked">NSFW</label>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckChecked" checked>
                        <label class="form-check-label" for="flexSwitchCheckChecked">Encrypted</label>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckChecked" checked>
                        <label class="form-check-label" for="flexSwitchCheckChecked">Full Slots</label>
                    </div>
                </div>
            </div>
            </div>
        </div>
        <!-- tabs -->
        <div class="tab-content">

            <!-- cc -->
            <div v-if="cc" role="tabpanel" class="tab-pane" id="ccTab" aria-labelledby="cctab">
                 <!-- no files -->
                <div v-if="hasFiles" class="ms-auto me-auto text-center">
                    <div class="ms-auto me-auto card px-3 py-2 mt-3 mb-4 bg-darker" style="max-width: 600px">
                        <h2 class="fw-light mt-1">No files found</h2>
                        <p class="lead mb-1" v-if="!nodeview">
                            Click <a class="btn btn-sm btn-primary no-decoration small" style="font-size: 0.6em;"
                                role="button" data-bs-toggle="tab" href="#contractsTab"><i
                                    class="fa-solid fa-list fa-fw me-1"></i>Contracts Tab
                            </a> to upload files
                        </p>
                    </div>
                </div>
                
                <!-- has files -->
                <div v-if="!hasFiles" class="d-flex flex-wrap justify-content-center">
                        <files-vue :assets="assets" @addassets="addAssets($event)" :account="saccountapi.name" :current="saccountapi.head_block" :cc="true"
                            :contracts="contracts"></files-vue>
                   
                </div>
            </div>
        
            
            <!-- files -->
            <div v-else role="tabpanel" class="tab-pane" :id="'filesTab' + title" aria-labelledby="filestab">
                
                <!-- no files -->
                <div v-show="!contracts.length"> 
                    <div class="ms-auto me-auto d-flex justify-content-center">
                        <div class="card mx-1 px-3 py-2 mt-3 mb-4 bg-darker" style="max-width: 600px">
                            <h2 class="fw-light mt-1">No files found</h2>
                            <p class="lead mb-1" v-if="nodeview && title == 'stored'">The TROLE API service can take up to 10 minutes to update data</p>
                            <p class="lead mb-1" v-if="!nodeview || title == 'new'" v-show="saccountapi.spk_power">
                            Click 
                                <a class="btn btn-sm btn-dark border-info text-info no-decoration small" style="font-size: 0.6em; width: 72px;" role="button" data-bs-toggle="modal" data-bs-target="#contractModal">
                                    <modal-vue type="build" token="BROCA"
                                        :balance="broca_calc(saccountapi.broca)" :account="account"
                                        @modalsign="toSign=$event" :ipfsproviders="ipfsProviders"
                                        v-slot:trigger>
                                        <span slot="trigger" class="trigger"><i
                                                class="fa-solid fa-file-contract fa-fw me-1"></i>NEW</span>
                                    </modal-vue>
                                </a>
                                    to create a contract using SPK Power
                                
                            </p>
                            <p class="lead mb-1" v-if="!nodeview">
                                Click <a class="btn btn-sm btn-dark border-success text-success no-decoration small" style="font-size: 0.6em; width:72px;"
                                    role="button" data-bs-toggle="modal" data-bs-target="#sponsoredModal"><i
                                        class="fa-solid fa-wand-magic-sparkles fa-fw me-1"></i>FREE</a>
                                to select a sponsored contract</p>
                                
                                
                        </div>
                    </div>
                </div>
                
                <!-- has files -->
                <div v-if="contracts.length" class="d-flex flex-wrap justify-content-center">
                    
                        <files-vue :assets="assets" @addassets="addAssets($event)" :account="saccountapi.name" :current="saccountapi.head_block"
                            :contracts="contracts"></files-vue>
                   
                </div>
            </div>

            
            
            <!-- contracts -->
            <div role="tabpanel" class="tab-pane show active" :id="'contractsTab' + title" aria-labelledby="contractstab">
                
                <div class="card-body p-0">
                    <!-- registered -->
                    <div v-if="saccountapi.pubKey != 'NA'">
                        
                        <!-- no contracts -->
                        <div v-show="!contracts.length"> 
                            <div class="ms-auto me-auto d-flex justify-content-center">
                                <div class="card mx-1 px-3 py-2 mt-3 mb-4 bg-darker" style="max-width: 600px">
                                    <h2 class="fw-light mt-1">No contracts found</h2>
                                    <p class="lead mb-1" v-if="nodeview && title == 'stored'">The TROLE API service can take up to 10 minutes to update data</p>
                                    <p class="lead mb-1" v-show="saccountapi.spk_power" v-if="!nodeview || title == 'new'">Click <a
                                                class="btn btn-sm btn-dark border-info text-info no-decoration small" style="font-size: 0.6em; width: 72px;"
                                                role="button" data-bs-toggle="modal" data-bs-target="#contractModal">
                                                <modal-vue type="build" token="BROCA"
                                                    :balance="broca_calc(saccountapi.broca)" :account="account"
                                                    @modalsign="toSign=$event" :ipfsproviders="ipfsProviders"
                                                    v-slot:trigger>
                                                    <span slot="trigger" class="trigger"><i
                                                            class="fa-solid fa-file-contract fa-fw me-1"></i>NEW</span>
                                                </modal-vue></a>
                                            to create a contract using SPK Power
                                    </p>
                                    <p class="lead mb-1" v-if="!nodeview">
                                        Click <a class="btn btn-sm btn-dark border-success text-success no-decoration small" style="font-size: 0.6em; width:72px;"
                                            role="button" data-bs-toggle="modal" data-bs-target="#sponsoredModal"><i
                                                class="fa-solid fa-wand-magic-sparkles fa-fw me-1"></i>FREE</a>
                                        to select a sponsored contract</p>
                                        
                                </div>
                            </div>
                        </div>

                        <!-- contracts -->
                        <div v-show="contracts.length">
                            <table class="table table-hover text-center align-middle mb-0" id="files-table">
                                <thead>
                                    <tr>
                                        <!-- storage -->
                                        <th scope="col">
                                            <div class="d-flex flex-wrap align-items-center justify-content-center">
                                                <div class="d-flex flex-wrap align-items-center justify-content-center">
                                                    <i class="fa-solid fa-database fa-fw"></i>
                                                    <span class="m-1">Storage</span>
                                                </div>
                                                <div class="d-flex align-items-center">
                                                    <button class="btn btn-sm btn-secondary"
                                                        @click="sortContracts('a','asc')"><i
                                                            class="fa-solid fa-caret-up"></i></button>
                                                    <button class="btn btn-sm btn-secondary ms-1"
                                                        @click="sortContracts('a','dec')"><i
                                                            class="fa-solid fa-caret-down"></i></button>
                                                </div>
                                            </div>
                                        </th>


                                        <!-- status -->
                                        <th scope="col">
                                            <div class="d-flex flex-wrap align-items-center justify-content-center">
                                                <div class="d-flex flex-wrap align-items-center justify-content-center">
                                                    <i class="fa-solid fa-signal fa-fw"></i>
                                                    <span class="m-1">Status</span>
                                                </div>
                                                <div class="d-flex align-items-center">
                                                    <button class="btn btn-sm btn-secondary ms-1"
                                                        @click="sortContracts('c','asc')"><i
                                                            class="fa-solid fa-caret-up"></i></button>
                                                    <button class="btn btn-sm btn-secondary ms-1"
                                                        @click="sortContracts('c','dec')"><i
                                                            class="fa-solid fa-caret-down"></i></button>
                                                </div>
                                            </div>
                                        </th>

                                        <!-- expires -->
                                        <th scope="col">
                                            <div class="d-flex flex-wrap align-items-center justify-content-center">
                                                <div class="d-flex flex-wrap align-items-center justify-content-center">
                                                    <i class="fa-solid fa-clock fa-fw"></i>
                                                    <span class="m-1">Expires</span>
                                                </div>
                                                <div class="d-flex align-items-center">
                                                    <button class="btn btn-sm btn-secondary"
                                                        @click="sortContracts('e','dec')"><i
                                                            class="fa-solid fa-caret-up"></i></button>
                                                    <button class="btn btn-sm btn-secondary ms-1"
                                                        @click="sortContracts('e','asc')"><i
                                                            class="fa-solid fa-caret-down"></i></button>
                                                </div>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr v-for="contract in contracts" class="text-start">
                                        <td colspan="4" class="p-0">
                                            <div class="table-responsive">
                                                <table class="table text-white align-middle mb-0">
                                                    <tbody class="border-0">
                                                        <tr class="border-0 click-me" data-bs-toggle="collapse" :href="'#' + replace(contract.i)" aria-expanded="false" aria-controls="collapseExample">

                                                            <!-- storage -->
                                                            <th class="border-0">
                                                                <div class="d-flex align-items-center">
                                                                    <div class="border border-1 border-light text-light rounded p-05 me-2" v-if="!nodeview">
                                                                            <i class="fa-solid fa-file fa-fw"></i>
                                                                    </div>
                                                                    <div v-if="nodeview" class="border border-1 rounded p-05 me-2" :class="{'border-light text-light': !isStored(contract.i), 'border-success text-success': isStored(contract.i)}">
                                                                       <div class="d-flex align-items-center"><i class="fa-solid fa-file fa-fw my-05"></i><span class="my-0 mx-1 d-none d-lg-block" v-if="nodeview">{{isStored(contract.i) ? 'Stored' : 'Available'}}</span></div>
                                                                    </div>
                                                                    <div>
                                                                        {{contract.c > 1 ? fancyBytes(contract.u) : fancyBytes(contract.a)}}
                                                                    </div>
                                                                </div>
                                                            </th>

                                                            <!-- status -->
                                                            <td class="border-0">
                                                                <div class="d-flex align-items-center">

                                                                    <!-- upload btn -->
                                                                    <div v-if="contract.c == 1" class="border border-1 border-success text-success rounded p-05 me-2">
                                                                        <i class="fa-solid fa-file-upload fa-fw"></i>
                                                                    </div>
                                                                    
                                                                    <!-- post btn -->
                                                                    <div v-if="contract.c == 2" class="border border-1 border-warning text-warning rounded p-05 me-2">
                                                                        <i class="fa-solid fa-hand-holding-dollar fa-fw"></i>
                                                                    </div>
                                                                   
                                                                    <!-- extend btn -->
                                                                    <div v-if="contract.c == 3" class="border border-1 border-primary text-primary rounded p-05 me-2">
                                                                        <i class="fa-solid fa-clock-rotate-left fa-fw"></i>
                                                                    </div>

                                                               
                                                                   
                                                                    <!-- message -->
                                                                    <div v-if="contract.c == 1">
                                                                            <span class="d-lg-none">Upload</span>
                                                                            <span class="d-none d-lg-flex">Ready for
                                                                                upload</span>
                                                                    </div>
                                                                    <div v-if="contract.c == 2">
                                                                            <span class="d-lg-none">Post</span>
                                                                            <span class="d-none d-lg-flex">Post
                                                                                {{split(contract.s, ',', 1)/100}}% to @{{split(contract.s, ',', 0)}}</span>
                                                                    </div>
                                                                    <div v-if="contract.c == 3">
                                                                            <span class="d-lg-none">Extend</span>
                                                                            <span class="d-none d-lg-flex align-items-center"> {{contract.nt}} /
                                                                                {{contract.p}}  <i class="fa-solid fa-tower-broadcast mx-1 fa-fw"></i> nodes </span>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <!-- expires -->
                                                            <td class="border-0">
                                                                <div class="d-flex align-items-center">
                                                                    <div class="border border-1 border-light text-light rounded p-05 me-2">
                                                                        <i class="fa-solid fa-circle-info fa-fw"></i>
                                                                    </div>
                                                                    
                                                                    <span v-if="contract.c">
                                                                        {{exp_to_time(contract.e)}}
                                                                    </span>

                                                                </div>
                                                            </td>
                                                        </tr>

                                                        <!-- collapse region -->

                                                        <!-- detail view -->
                                                        <tr class="collapse" :id="replace(contract.i)">
                                                            <td class="border-0 px-0 px-md-1" colspan="4">
                                                                <div class="d-flex flex-column border border-white rounded text-start py-2" style="background-color:rgba(0,0,0,0.3);">

                                                                    <!-- contract ID -->
                                                                    <div class="d-flex justify-content-center small text-white-50 mb-3">
                                                                        <div class="text-center"> Contract ID <i class="fa-solid fa-file-contract fa-fw mx-1" aria-hidden="true"></i><span class="text-break">{{contract.i}}</span>
                                                                        </div>
                                                                    </div>
                                                               

                                                                    <!-- upload time banner -->
                                                                    <div v-if="contract.c == 1" class="mx-1 mb-3">
                                                                        <div class="alert alert-warning d-flex align-items-center mx-lg-5">
                                                                            <div class="d-flex flex-grow-1 flex-wrap me-1 align-items-center">
                                                                                <div class="mx-1">
                                                                                    <div class="fs-3 fw-lighter">You have {{exp_to_time(contract.e)}} to start this contract</div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="ms-auto d-flex flex-wrap align-items-center fs-1 text-warning justify-content-center me-2 mx-1">
                                                                                <i class="fa-solid fa-bell fa-fw ms-2"></i>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <!-- post time banner -->
                                                                    <div v-if="contract.c == 2" class="mx-1 mx-lg-5 mb-3">
                                                                        <div class="alert alert-warning d-flex align-items-center ">
                                                                            <div class="d-flex flex-grow-1 flex-wrap me-1 align-items-center">
                                                                                <div class="mx-1">
                                                                                    <div class="fs-3 fw-lighter">You have {{exp_to_time(contract.e)}} to publish this contract</div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="ms-auto d-flex flex-wrap align-items-center fs-1 text-warning justify-content-center me-2 mx-1">
                                                                                <i class="fa-solid fa-bell fa-fw ms-2"></i>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    

                                                                    <!-- post -->
                                                                    <div v-if="spkapi.name == contract.t && !postpage && contract.c == 2" class="mb-3 mx-1 mx-lg-5 p-sm-1 p-lg-2 rounded" style="background-color:rgba(0,0,0,0.3)">
                                                                        <div class="d-flex flex-column">
                                                                            <div>
                                                                                <div class="mx-auto ms-md-1 mt-2 lead fs-2">Post Details</div>
                                                                            </div>
                                                                            <div class="bg-dark px-1 py-2 p-lg-3 mt-2 rounded">
                                                                                <post-vue :account="account"
                                                                                :prop_bens="[contract.s]"
                                                                                :prop_uid="contract.i"
                                                                                :prop_links="links[contract.i]"
                                                                                :prop_insert="postBodyAdder[contract.i]"
                                                                                @tosign="toSign=$event" />
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <!-- upload -->
                                                                    <div v-if="contract.c == 1" class="mx-1">
                                                                        <upload-vue :user="saccountapi" :propcontract="contract" @tosign="toSign=$event" @done="done()" />
                                                                    </div>


                                                                   

                                                                    
                                                                    <!-- files list -->
                                                                    <div v-if="contract.c > 1">

                                                                        <div class="mx-1" v-if="contract.c > 2"> 
                                                                            <div class="gradient-border bg-dark mb-3 mx-1 mx-lg-5 p-sm-1 p-lg-2"> 
                                                                                <div class="d-flex flex-wrap justify-content-around justify-content-md-between mx-1 mx-md-2 pt-1 pt-md-2">
                                                                                    <div class="fs-1 fw-bold align-items-start">SPK Network</div>
                                                                                   <div class="input-group-text">
                                                                                        <div class="form-check form-switch fs-5" :class="{'is-danger': !saccountapi.spk}">
                                                                                            <input class="form-check-input" type="checkbox" checked="" role="switch" :id="contract.i + 'autoRenew'" v-model="newMeta[contract.i].contract.autoRenew" :class="{'disabled': contract.t != account}" :disabled="contract.t != account">
                                                                                            <label class="form-check-label ms-auto" :class="{'text-danger': !saccountapi.spk}" :for="contract.i + 'autoRenew'">Auto-Renew</label>
                                                                                        </div>
                                                                                    </div>
                                                                                 
                                                                                </div>

                                                                                <!-- extension -->
                                                                                <div v-if="contract.c == 3" >
                                                                                            <extension-vue :node-view="nodeview"
                                                                                            :contract="contract" :sstats="sstats"
                                                                                            :account="account" :saccountapi="saccountapi" :spkapi="spkapi"
                                                                                            @tosign="toSign=$event"></extension-vue> 
                                                                                </div>

                                                                                <!-- save button -->
                                                                                <div class="d-flex text-center">
                                                                                    <button v-if="contract.c > 1 && metaMismatch(contract.i) && !newMeta[contract.i].contract.encrypted" class="btn btn-lg btn-outline-warning mx-auto my-2" type="button" @click="update_meta(contract.i)"><i class="fa-solid fa-floppy-disk fa-fw me-2"></i>Save Metadata</button>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div class="mb-3 mx-1 mx-lg-5 p-sm-1 p-lg-2 rounded" style="background-color:rgba(0,0,0,0.3)">
                                                                            <div class="d-flex flex-column">
                                                                                <div>
                                                                                    <div class="mx-auto ms-md-1 mt-2 lead fs-2">{{pluralFiles(contract.i)}} File{{pluralFiles(contract.i) > 1 ? 's' : ''}}</div>
                                                                                </div>
                                                                                
                                                                                
                                                                                <div v-for="(size, cid, index) in contract.df">
                                                                                    <div v-if="!newMeta[contract.i][cid].is_thumb" class="mt-2 rounded card p-2">

                                                                                        <div class="row align-items-center"> 

                                                                                            <div class="col-md-4">
                                                                                                <div class="d-flex flex-column justify-content-center">

                                                                                                    
                                                                                                    <img v-if="newMeta[contract.i][cid].thumb" class="mx-auto img-fluid rounded bg-light" :src="newMeta[contract.i][cid].thumb_data" width="314px" >
                                                                                                    <div v-else class="bg-light rounded">    
                                                                                                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                                                                                viewBox="0 0 800 800" style="enable-background:new 0 0 800 800;" xml:space="preserve" >
                                                                                                            
                                                                                                            <g >
                                                                                                                <path class="st0" d="M650,210H500c-5.5,0-10-4.5-10-10V50c0-5.5,4.5-10,10-10s10,4.5,10,10v140h140c5.5,0,10,4.5,10,10
                                                                                                                    S655.5,210,650,210z"/>
                                                                                                                <path class="st0" d="M650,309.7c-5.5,0-10-4.5-10-10v-95.5L495.9,60H200c-22.1,0-40,17.9-40,40v196.3c0,5.5-4.5,10-10,10
                                                                                                                    s-10-4.5-10-10V100c0-33.1,26.9-60,60-60h300c2.7,0,5.2,1,7.1,2.9l150,150c1.9,1.9,2.9,4.4,2.9,7.1v99.7
                                                                                                                    C660,305.2,655.5,309.7,650,309.7z"/>
                                                                                                                <path class="st0" d="M600,760H200c-33.1,0-60-26.9-60-60V550c0-5.5,4.5-10,10-10s10,4.5,10,10v150c0,22.1,17.9,40,40,40h400
                                                                                                                    c22.1,0,40-17.9,40-40V550c0-5.5,4.5-10,10-10s10,4.5,10,10v150C660,733.1,633.1,760,600,760z"/>
                                                                                                                <path class="st0" d="M550,560H250c-5.5,0-10-4.5-10-10s4.5-10,10-10h300c5.5,0,10,4.5,10,10S555.5,560,550,560z"/>
                                                                                                                <path class="st0" d="M400,660H250c-5.5,0-10-4.5-10-10s4.5-10,10-10h150c5.5,0,10,4.5,10,10S405.5,660,400,660z"/>
                                                                                                                <path class="st0" d="M650,560H150c-33.1,0-60-26.9-60-60l0,0V346.3c0-33.1,26.9-60,60-60l0,0h0.4l500,3.3
                                                                                                                    c32.9,0.3,59.5,27.1,59.6,60V500C710,533.1,683.2,560,650,560C650,560,650,560,650,560z M150,306.3c-22.1,0-40,17.9-40,40V500
                                                                                                                    c0,22.1,17.9,40,40,40h500c22.1,0,40-17.9,40-40V349.7c-0.1-22-17.8-39.8-39.8-40l-500-3.3H150z"/>
                                                                                                                <text transform="matrix(1 0 0 1 233.3494 471.9725)" class="st1 st2" style="text-transform: uppercase; font-size: 149px;">{{newMeta[contract.i][cid].type}}</text>
                                                                                                            </g>
                                                                                                        </svg>
                                                                                                    </div>

                                                                                                    <span class="small text-center mb-2">{{fancyBytes(size)}}</span>
                                                                                                    
                                                                                                    <!-- link -->
                                                                                                    <div v-if="!newMeta[contract.i][cid].encrypted">
                                                                                                        <a :href="'https://ipfs.dlux.io/ipfs/' + cid" target="_blank" class="w-100 btn btn-sm btn-primary mb-1 mx-auto"><span class="d-flex align-items-center">URL<i class="ms-auto fa-solid fa-fw fa-up-right-from-square"></i></span></a>
                                                                                                    </div>
                                                                                                    <!-- download  -->
                                                                                                    <div class="d-none" v-if="!newMeta[contract.i][cid].encrypted">
                                                                                                        <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="downloadFile(cid, contract.i, index)"><span class="d-flex align-items-center w-100">Download<i class="fa-solid fa-download fa-fw ms-auto"></i></span></button>
                                                                                                    </div>
                                                                                                    <!-- decrypt  -->
                                                                                                    <div v-if="newMeta[contract.i][cid].encrypted && !contract.encryption.key">
                                                                                                        <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="decryptKey(contract.i)"><span class="d-flex align-items-center w-100">Decrypt<i class="fa-solid fa-fw ms-auto fa-lock-open"></i></span></button>
                                                                                                    </div>
                                                                                                    <!-- download enc -->
                                                                                                    <div v-if="newMeta[contract.i][cid].encrypted && contract.encryption.key">
                                                                                                        <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="downloadFile(cid, contract.i, index)"><span class="d-flex align-items-center w-100">Download<i class="fa-solid fa-download fa-fw ms-auto"></i></span></button>
                                                                                                    </div>
                                                                                                        <!-- add to post -->
                                                                                                    <div v-if="contract.c == 2">
                                                                                                        <button type="button" class="w-100 btn btn-sm btn-purp mb-1 mx-auto" @click="addToPost(cid, contract.i)"><span class="d-flex align-items-center w-100">Add to Post<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                                                                                                    </div>

                                                                                                    

                                                                                                    
                                                                                                </div>
                                                                                            </div>

                                                                                            <div class="col-md-8"> 

                                                                                                <div class="mb-1">    
                                                                                                    <label class="mb-1">File Name</label>
                                                                                                    <div class="input-group">
                                                                                                        <input autocapitalize="off" v-model="newMeta[contract.i][cid].name" placeholder="File Name" pattern="[a-zA-Z0-9]{3,25}" class="form-control bg-dark border-0" :class="{'text-info': contract.t == account, 'text-white': contract.t != account}" :disabled="contract.t != account">
                                                                                                        <span class="input-group-text bg-dark border-0">.</span>
                                                                                                        <input autocapitalize="off" v-model="newMeta[contract.i][cid].type" placeholder="File Type" pattern="[a-zA-Z0-9]{1,4}" class="form-control bg-dark border-0" :class="{'text-info': contract.t == account, 'text-white': contract.t != account}" :disabled="contract.t != account">
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div class="mb-1">
                                                                                                    <label class="mb-1">Thumbnail</label>
                                                                                                    <div class="position-relative has-validation">
                                                                                                        <input autocapitalize="off" v-model="newMeta[contract.i][cid].thumb" @change="getImgData(contract.i, cid)" placeholder="https://your-thumbnail-image.png" pattern="https:\/\/[a-z0-9.-\/]+|Qm[a-zA-Z0-9]+" class="form-control bg-dark border-0" :class="{'text-info': contract.t == account, 'text-white': contract.t != account}" :disabled="contract.t != account">
                                                                                                    </div>
                                                                                                </div>

                                                                                                <!-- choices-js-->
                                                                                                <div class="mb-1">
                                                                                                    <label class="mb-1">Tags</label>
                                                                                                    <choices-vue ref="select-tag" :prop_selections="newMeta[contract.i][cid].flags" prop_type="tags" @data="handleTag(contract.i, cid, $event)" :class="{'text-info': contract.t == account, 'text-white disabled': contract.t != account}" :disabled="contract.t != account"></choices-vue>
                                                                                                </div>
                                                                                                <div class="mb-1">
                                                                                                    <label class="mb-1">License</label>
                                                                                                    <choices-vue ref="select-tag" :prop_selections="newMeta[contract.i][cid].license" prop_type="license" @data="handleLicense(contract.i, cid, $event)" :class="{'text-info': contract.t == account, 'text-white': contract.t != account}" :disabled="contract.t != account"></choices-vue>
                                                                                                </div>
                                                                                                <div class="mb-1">
                                                                                                    <label class="mb-1">Labels</label>
                                                                                                    <choices-vue ref="select-label" :prop_selections="newMeta[contract.i][cid].labels" prop_type="labels" @data="handleLabel(contract.i, cid, $event)" :class="{'text-info': contract.t == account, 'text-white': contract.t != account}" :disabled="contract.t != account"></choices-vue>
                                                                                                </div> 
                                                                                                
                                                                                            </div>

                                                                                        </div>

                                                                                        <!-- save button -->
                                                                                        <div class="d-flex text-center">
                                                                                            <button v-if="contract.c > 1 && metaMismatch(contract.i) && !newMeta[contract.i].contract.encrypted" class="btn btn-lg btn-outline-warning mx-auto my-2" type="button" @click="update_meta(contract.i)"><i class="fa-solid fa-floppy-disk fa-fw me-2"></i>Save Metadata</button>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div v-for="(size, cid, index) in contract.df">
                                                                                    <div v-if="newMeta[contract.i][cid].is_thumb" class="mt-2 rounded bg-dark p-2">
                                                                                        Thumb: {{getdelimed(newMeta[contract.i][cid].name, 'thumb', 1)}}.{{newMeta[contract.i][cid].type}} - {{cid}} - {{fancyBytes(size)}}
                                                                                    </div>
                                                                                </div>
                                                                                <!-- encrypted sharing  -->
                                                                                <div v-if="contract.c > 1 && newMeta[contract.i].contract.encrypted" class="mt-3">
                                                                                    
                                                                                        <div class="d-flex flex-column flex-grow-1">
                                                                                            <div class="fs-3 fw-lighter">Sharing</div>
                                                                                            <p v-if="contract.t == spkapi.name">{{pluralFiles(contract.i) > 1 ? 'These files are' : 'This file is'}} encrypted. You can add and remove accounts that can decrypt {{pluralFiles(contract.i) > 1 ? 'them' : 'it'}}.</p>
                                                                                            <p v-if="contract.t != spkapi.name">{{pluralFiles(contract.i) > 1 ? 'These files are' : 'This file is'}} encrypted and shared with the following:</p>
                                                                                            
                                                                                            <!-- decrypt button -->
                                                                                            <div class="mb-2" v-if="contract.t == spkapi.name && !contract.encryption.key">
                                                                                                    <div class="w-100 btn btn-lg btn-dark" @click="decryptKey(contract.i)">Decrypt to Modify<i class="fa-solid fa-fw ms-2 fa-lock-open"></i></div>
                                                                                            </div>
                                                                                            
                                                                                            <!-- username input add -->
                                                                                            <div class="d-flex mb-2" v-if="contract.t == spkapi.name && contract.encryption.key">
                                                                                                <div class="me-1 flex-grow-1">
                                                                                                    <div class="position-relative has-validation">
                                                                                                        <input autocapitalize="off" placeholder="username" class="form-control border-light bg-darkg text-info" v-model="contract.encryption.input" @keyup.enter="addUser(contract.i)">
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div class="ms-1">
                                                                                                    <div class="btn btn-lg btn-light" @click="addUser(contract.i)"><i class="fa-solid fa-fw fa-plus"></i></div>
                                                                                                </div>
                                                                                            </div>
                                                                                            
                                                                                            <!-- shared accounts -->
                                                                                            <div class="d-flex flex-row flex-wrap mb-2">
                                                                                                <div v-for="(a,b,c) in contract.encryption.accounts">
                                                                                                    <div :class="{'bg-white' : contract.encryption.key && b != contract.t, 'bg-white-50' : !contract.encryption.key || b == contract.t}" class="rounded text-black filter-bubble me-1 mb-1 d-flex align-items-center">    
                                                                                                        <div class="d-flex align-items-center">
                                                                                                            <i class="fa-solid fa-key fa-fw me-1" :class="{'text-primary': contract.encryption.accounts[b].enc_key, 'text-warning': !contract.encryption.accounts[b].enc_key}"></i>
                                                                                                            <span>{{b}}</span>
                                                                                                            <div v-if="contract.t == spkapi.name && contract.encryption.key && b != contract.t"><button type="button" class="ms-2 btn-close small btn-close-white" @click="delUser(contract.i, b)"></button></div>
                                                                                                            <div v-if="b == spkapi.name && !contract.encryption.key"><button type="button" class="d-none ms-2 small btn-white" @click="decryptKey(contract.i)"><i class="fa-solid fa-fw mx-1 fa-lock-open" aria-hidden="true"></i></button></div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>

                                                                                                <!-- encrypt / save button -->
                                                                                            <div class="d-flex text-center">
                                                                                                <button v-if="unkeyed(contract.i)" class="mx-auto mb-2 btn btn-lg btn-outline-warning" type="button" @click="checkHive(contract.i)"><i class="fa-solid fa-fw fa-user-lock me-2"></i>Encrypt Keys</button>
                                                                                                <button v-if="metaMismatch(contract.i) && !unkeyed(contract.i)" class="btn btn-lg btn-outline-warning mx-auto mb-2" type="button" @click="update_meta(contract.i)"><i class="fa-solid fa-floppy-disk fa-fw me-2"></i>Save Metadata</button>
                                                                                            </div>

                                                                                            
                                                                                            
                                                                                        </div>
                                                                                    
                                                                                </div>

                                                                                    <!-- save button 
                                                                                <div class="d-flex text-center">
                                                                                    <button v-if="contract.c > 1 && metaMismatch(contract.i) && !newMeta[contract.i].contract.encrypted" class="btn btn-lg btn-outline-warning mx-auto my-2" type="button" @click="update_meta(contract.i)"><i class="fa-solid fa-floppy-disk fa-fw me-2"></i>Save Metadata</button>
                                                                                </div>
                                                                                -->
                                                                            </div>
                                                                        </div>
                                                                    </div>


                                                                    


                                                                   

                                                                    

                                                                    <!-- contract details -->
                                                                    <div class="d-flex flex-wrap justify-content-center my-3 small mx-lg-5">

                                                                        
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Owner </div>
                                                                            <i class="fa-solid fa-user fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div><a :href="'/@' + contract.t" class="no-decoration text-primary">@{{contract.t}}</a></div>
                                                                            </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Sponsor </div>
                                                                            <i class="fa-solid fa-user-shield fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div><a :href="'/@' + contract.f"
                                                                            class="no-decoration text-primary">@{{contract.f}}</a></div>
                                                                        </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Service Provider </div>
                                                                            <i class="fa-solid fa-user-gear fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div><a :href="'/@' + contract.b"
                                                                            class="no-decoration text-primary">@{{contract.b}}</a></div>
                                                                        </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Size </div>
                                                                            <i class="fa-solid fa-warehouse fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div>{{contract.c > 1 ? fancyBytes(contract.u) : fancyBytes(contract.a)}}</div>
                                                                        </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Redundancy </div>
                                                                            <i class="fa-solid fa-tower-broadcast fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div>{{contract.p}} nodes</div>
                                                                        </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Expiration </div>
                                                                            <i class="fa-solid fa-clock fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div>{{exp_to_time(contract.e)}}</div>
                                                                        </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Price </div>
                                                                            <i class="fa-solid fa-atom fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div>{{formatNumber(contract.r,'3','.',',')}}
                                                                            Broca</div>
                                                                        </div>
                                                                        <div v-if="contract.s" class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Terms </div>
                                                                            <i class="fa-solid fa-hand-holding-dollar fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div>{{slotDecode(contract.s, 1)}}%
                                                                            Beneficiary to <a :href="'/@' + slotDecode(contract.s, 0)"
                                                                            class="no-decoration text-primary">@{{slotDecode(contract.s, 0)}}</a></div>
                                                                        </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white">
                                                                            <div> Status </div>
                                                                            <i class="fa-solid fa-signal fa-fw mx-1" aria-hidden="true"></i>
                                                                            <div> {{contract.c == 1 ? 'Waiting For Upload' : 'Uploaded'}}</div>
                                                                        </div>
                                                                        <div class="d-flex align-items-center px-3 py-1 m-1 rounded-pill border border-white" v-if="newMeta[contract.i]">
                                                                            <div> Privacy </div>
                                                                            <i class="fa-solid fa-fw mx-1" :class="{'fa-lock-open': !newMeta[contract.i].contract.encrypted, 'fa-lock': newMeta[contract.i].contract.encrypted}" aria-hidden="true"></i>
                                                                            <div>{{newMeta[contract.i].contract.encrypted ? 'Private' : 'Public'}}</div>
                                                                        </div>
                            
                                                                    </div>

                                                                    <div class="d-flex">
                                                                        <button type="button" class="btn btn-sm btn-danger my-2 mx-auto" @click="cancel_contract(contract)">
                                                                        <i class="fa-solid fa-file-circle-xmark fa-fw me-1"></i>End Contract</button>
                                                                    </div>
                                                                </div>

   
                                                               

                                                                
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>

`,
    props: {
        account: {
            default: ''
        },
        sapi: {
            default: 'https://spktest.dlux.io'
        },
        nodeview: {
            default: false
        },
        cc: {
            default: false
        },
        prop_contracts: {
            default: function () {
                return []
            }
        },
        files: {
            type: Object,
            default: {},
        },
        assets: {
            default: false,
            required: false
        },
        title: {
            default: 'Storage Contracts',
            required: false
        },
        postpage: {
            default: false,
            required: false
        },
        accountinfo: {
            default: function () {
                return {}
            },
            required: false
        },
        spkapi: {
            default: function () {
                return {}
            },
            required: false
        }
    },
    data() {
        return {
            contracts: [],
            filter: {
                slots: true,
                size: 0,
            },
            postBodyAdder: {},
            newMeta: {},
            state2contracts: [],
            tick: "1",
            toSign: {},
            larynxbehind: 999999,
            lbalance: 0,
            lbargov: 0,
            spkval: 0,
            usedBytes: 0,
            availableBytes: 0,
            sstats: {},
            links: {},
            contractIDs: {},
            saccountapi: {
                spk: 0,
                balance: 0,
                gov: 0,
                poweredUp: 0,
                claim: 0,
                granted: {
                    t: 0
                },
                granting: {
                    t: 0
                }
            },
            ipfsProviders: {},
            tokenGov: {
                title: "SPK VOTE",
                options: [
                    {
                        id: "spk_cycle_length",
                        range_low: 28800,
                        range_high: 2592000,
                        info: "Time in blocks to complete a power down cycle. 4 cycles to completely divest. 28800 blocks per day.",
                        val: 200000,
                        step: 1,
                        unit: "Blocks",
                        title: "Down Power Period"
                    },
                    {
                        id: "dex_fee",
                        range_low: 0,
                        range_high: 0.01,
                        info: "Share of DEX completed DEX trades to allocate over the collateral group.",
                        val: 0.00505,
                        step: 0.000001,
                        unit: "",
                        title: "DEX Fee"
                    },
                    {
                        id: "dex_max",
                        range_low: 28800,
                        range_high: 2592000,
                        info: "Largest open trade size in relation to held collateral.",
                        val: 97.38,
                        step: 1,
                        unit: "%",
                        title: "Max Trade Size"
                    },
                    {
                        id: "dex_slope",
                        range_low: 0,
                        range_high: 100,
                        info: "0 Allows any size buy orders to be placed. 1 will disallow large buy orders at low prices.",
                        val: 48.02,
                        step: 0.01,
                        unit: "%",
                        title: "Max Lowball Trade Size"
                    },
                    {
                        id: "spk_rate_ldel",
                        range_low: 0.00001, //current lpow
                        range_high: 0.0001, //current lgov
                        info: "SPK generation rate for delegated LARYNX Power",
                        val: 0.00015,
                        step: 1,
                        unit: "",
                        title: "SPK Gen Rate: Delegated"
                    },
                    {
                        id: "spk_rate_lgov",
                        range_low: 0.00015, //current ldel
                        range_high: 0.01,
                        info: "SPK generation rate for Larynx Locked",
                        val: 0.001,
                        step: 0.000001,
                        unit: "",
                        title: "SPK Gen Rate: Locked"
                    },
                    {
                        id: "spk_rate_lpow",
                        range_low: 0.000001,
                        range_high: 0.00015, //current ldel
                        info: "SPK generation rate for undelegated Larynx Power",
                        val: 0.0001,
                        step: 0.000001,
                        unit: "",
                        title: "Min SPK Gen Rate: Min"
                    },
                    {
                        id: "max_coll_members",
                        range_low: 25,
                        range_high: 79,
                        info: "The Max number of accounts that can share DEX fees. The richer half of this group controls outflows from the multisig wallet.",
                        val: 25,
                        step: 1,
                        unit: "Accounts",
                        title: "Size of collateral group"
                    }
                ]
            },
            contract: {
                api: '',
                id: '',
                files: '',
                fosig: '', //file-owner
                spsig: '', //service-provider 
                s: 10485760,
                t: 0
            }
        };
    },
    emits: ['tosign', 'addasset', 'bens', 'done'],
    methods: {
        getdelimed(string, del = ',', index = 0) {
            return string.split(del)[index] ? string.split(del)[index] : ''
        },
        sendIt(event){
            this.$emit('tosign', event)
        },
        getImgData(id, cid) {
            var string = this.smartThumb(id, cid)
            fetch(string).then(response => response.text()).then(data => {
                if(data.indexOf('data:image/') >= 0)this.newMeta[id][cid].thumb_data = data
                else this.newMeta[id][cid].thumb_data = string
            }).catch(e => {
                this.newMeta[id][cid].thumb_data = string
            })
        },
        addToPost(cid, contract, loc = 'self') {
            const string = `${this.newMeta[contract][cid].thumb ? '!' : ''}[${this.newMeta[contract][cid].name}.${this.newMeta[contract][cid].type}](https://ipfs.dlux.io/ipfs/${cid})`
            this.postBodyAdder[`${loc == 'self' ? contract : loc}`] = {
                string,
                contract: this.contractIDs[contract],
                cid,
            }
        },
        split(string, index = 0, del = ',') {
            return string.split(del)[index] ? string.split(del)[index] : ''
        },
        addUser(id) {
            if (this.contractIDs[id].encryption) {
                this.contractIDs[id].encryption.accounts[this.contractIDs[id].encryption.input] = {
                    key: '',
                    enc_key: '',
                }
                this.contractIDs[id].encryption.input = ''
            }
        },
        delUser(id, user) {
            delete this.contractIDs[id].encryption.accounts[user]
        },
        checkHive(id) {
            return new Promise((resolve, reject) => {
                this.fetching = true
                var accounts = Object.keys(this.contractIDs[id].encryption.accounts)
                var newAccounts = []
                for (var i = 0; i < accounts.length; i++) {
                    if (!this.contractIDs[id].encryption.accounts[accounts[i]]?.key) {
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
                                    this.contractIDs[id].encryption.accounts[data.result[i].name].key = data.result[i].memo_key
                                }
                            }
                            this.encryptKeyToUsers(id)
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
        encryptKeyToUsers(id) {
            return new Promise((resolve, reject) => {
                const usernames = Object.keys(this.contractIDs[id].encryption.accounts)
                var keys = []
                var dict = {}
                for (var i = 0; i < usernames.length; i++) {
                    if (!this.contractIDs[id].encryption.accounts[usernames[i]].enc_key) keys.push(this.contractIDs[id].encryption.accounts[usernames[i]].key)
                    dict[this.contractIDs[id].encryption.accounts[usernames[i]].key] = usernames[i]
                }
                const key = "#" + this.contractIDs[id].encryption.key;
                if (keys.length) hive_keychain.requestEncodeWithKeys(this.account, keys, key, 'Memo', (response) => {
                    console.log(response)
                    if (response.success) {
                        for (var node in response.result) {
                            this.contractIDs[id].encryption.accounts[dict[node]].enc_key = response.result[node]
                        }
                        resolve("OK")
                    } else {
                        reject(response.message);
                    }
                });
                else resolve(null)
            })
        },
        decryptKey(id) {
            return new Promise((resolve, reject) => {
                const key = this.contractIDs[id].encryption.accounts[this.spkapi.name].enc_key;
                hive_keychain.requestVerifyKey(this.spkapi.name, key, 'Memo', (response) => {
                    if (response.success) {
                        this.contractIDs[id].encryption.key = response.result.split('#')[1]
                        resolve("OK")
                    } else {
                        reject(response.message);
                    }
                });
            })
        },
        AESDecrypt(encryptedMessage, key) {
            const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
            return bytes.toString(CryptoJS.enc.Utf8);
        },
        downloadFile(cid, id) {
            fetch(`https://ipfs.dlux.io/ipfs/${cid}`)
                .then((response) => response.text())
                .then((blob) => {

                    const name = this.newMeta[id][cid].name + '.' + this.newMeta[id][cid].type || 'file'
                    if (this.contractIDs[id].encryption.key) {
                        blob = this.AESDecrypt(blob, this.contractIDs[id].encryption.key);
                        var byteString = atob(blob.split(',')[1])
                        var mimeString = blob.split(',')[0].split(':')[1].split(';')[0];
                        var ab = new ArrayBuffer(byteString.length);
                        var ia = new Uint8Array(ab);
                        for (var i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                        }
                        blob = new Blob([ab], { type: mimeString });
                    }
                    try {
                        var url = window.URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = name;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                    } catch (e) {
                        var url = window.URL.createObjectURL(response);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = name;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                    }

                });
        },
        smartThumb(contract, cid) {
            if (this.newMeta[contract][cid].thumb.includes('https://')) {
                return this.newMeta[contract][cid].thumb
            } else if (this.newMeta[contract][cid].thumb.includes('Qm')) {
                return `https://ipfs.dlux.io/ipfs/${this.newMeta[contract][cid].thumb}`
            } else return false
        },
        flagDecode(flags = "", flag = 0, omit = 0) {
            if (flag) return this.Base64toNumber(flags[0]) & flag
            if (flags.indexOf(',') > -1) flags = flags.split(',')[4]
            var num = this.Base64toNumber(flags[0])
            if (omit) num = num & ~omit
            var out = {}
            if (num & 1) out.enc = true
            if (num & 2) out.autoRenew = true
            if (num & 4) out.nsfw = true
            if (num & 8) out.executable = true
            return out
        },
        metaMismatch(contract) {
            var enc_string = ''
                for (var acc in this.contractIDs[contract].encryption.accounts) {
                    if (this.contractIDs[contract].encryption.accounts[acc].enc_key) enc_string += `${this.contractIDs[contract].encryption.accounts[acc].enc_key}@${acc};`
                }
                //remove last ;
                enc_string = `${this.newMeta[contract].contract.autoRenew ? '1' : ''}${enc_string.slice(0, -1)}`
                this.newMeta[contract].contract.enc_string = enc_string
                var cids = Object.keys(this.newMeta[contract])
                cids = cids.sort((a, b) => {
                    if (a > b) return 1
                    else if (a < b) return -1
                    else return 0
                })
                for (var i = 0; i < cids.length; i++) {
                    if (cids[i] != 'contract') {
                        enc_string += `,${this.newMeta[contract][cids[i]].name},${this.newMeta[contract][cids[i]].type},${this.newMeta[contract][cids[i]].thumb},${this.newMeta[contract][cids[i]].flags}-${this.newMeta[contract][cids[i]].license}-${this.newMeta[contract][cids[i]].labels}`
                    }
                }
            if (this.newMeta[contract].contract.m != enc_string) return true
        },
        update_meta(contract) {
            return new Promise((resolve, reject) => {
                console.log(this.newMeta[contract], contract)
                var enc_string = ''
                for (var acc in this.contractIDs[contract].encryption.accounts) {
                    if (this.contractIDs[contract].encryption.accounts[acc].enc_key) enc_string += `${this.contractIDs[contract].encryption.accounts[acc].enc_key}@${acc};`
                }
                //remove last ;
                enc_string = `${this.newMeta[contract].contract.autoRenew ? '1' : '0' }${enc_string.slice(0, -1)}`
                this.newMeta[contract].contract.enc_string = enc_string
                var cids = Object.keys(this.newMeta[contract])
                cids = cids.sort((a, b) => {
                    if (a > b) return 1
                    else if (a < b) return -1
                    else return 0
                })
                for (var i = 0; i < cids.length; i++) {
                    if (cids[i] != 'contract') {
                        enc_string += `,${this.newMeta[contract][cids[i]].name},${this.newMeta[contract][cids[i]].type},${this.newMeta[contract][cids[i]].thumb},${this.newMeta[contract][cids[i]].flags}-${this.newMeta[contract][cids[i]].license}-${this.newMeta[contract][cids[i]].labels}`
                    }
                }
                var cja = {
                    id: contract,
                    m: enc_string
                };
                const removeSave = new Promise((res, rej) => {
                    this.toSign = {
                        type: "cja",
                        cj: cja,
                        id: `spkccT_update_metadata`,
                        msg: `Updating Metadata for Contract: ${contract}`,
                        ops: [],
                        callbacks: [res, rej],
                        api: this.sapi,
                        txid: `spkccT_update_meta`,
                    };
                })
                removeSave.then(() => {
                    this.contractIDs[contract].m = cja.m
                    console.log(this.contractIDs[contract].m, cja.m)
                    resolve('OK')
                }).catch(e => {
                    reject(e)
                })
            })
        },
        done() {
            this.$emit('done')
        },
        modalSelect(url) {
            this.$emit('modalselect', url);
        },
        updatePubkey() {
            var cja = {
                pubKey: this.accountinfo.posting.key_auths[0][0]
            };
            this.toSign = {
                type: "cja",
                cj: cja,
                id: `spkccT_register_authority`,
                msg: `Registering: ${this.account}:${this.accountinfo.posting.key_auths[0][0]}`,
                ops: ["getSapi"],
                api: this.sapi,
                txid: `spkccT_register_authority`,
            };
        },
        addAssets(id, contract) {
            if (typeof id == 'object') this.$emit('addasset', id);
            else this.$emit('addasset', { id, contract });
        },
        sortContracts(on = 'c', dir = 'asc') {
            this.contracts.sort((a, b) => {
                if (a[on] > b[on]) {
                    return dir == 'asc' ? 1 : -1
                } else if (a[on] < b[on]) {
                    return dir == 'asc' ? -1 : 1
                } else {
                    return 0
                }
            })
            for (var i = 0; i < this.contracts.length; i++) {
                this.contracts[i].index = i
                this.contractIDs[this.contracts[i].i].index = i
            }
        },
        exp_to_time(exp = '0:0') {
            return this.when([parseInt(exp.split(':')[0])])
        },
        replace(string = "", char = ':') {
            return string.replaceAll(char, '_')
        },
        split(string, del, index) {
            return string.split(del)[index]
        },
        slotDecode(slot, index) {
            var item = slot.split(',')
            switch (index) {
                case 1:
                    return parseFloat(item[1] / 100).toFixed(2)
                    break;
                default:
                    return item[0]
                    break;
            } index
        },
        pluralFiles(id) {
            var count = 0
            for (var i in this.newMeta[id]) {
                if (i != 'contract' && !this.newMeta[id][i].is_thumb) count++
            }
            return count
        },
        getSapi(user = this.account) {
            if (user) fetch(this.sapi + "/@" + user)
                .then((response) => response.json())
                .then((data) => {
                    data.tick = data.tick || 0.01;
                    this.larynxbehind = data.behind;
                    this.lbalance = (data.balance / 1000).toFixed(3);
                    this.lbargov = (data.gov / 1000).toFixed(3);
                    data.powerDowns = Object.keys(data.power_downs);
                    for (var i = 0; i < data.powerDowns.length; i++) {
                        data.powerDowns[i] = data.powerDowns[i].split(":")[0];
                    }
                    // Storage nodes won't get contracts from here, we'll need some props from the contract
                    if (!this.nodeview) {
                        for (var node in data.file_contracts) {
                            data.file_contracts[node].encryption = {
                                input: "",
                                key: "",
                                accounts: {},
                            }
                            this.links[data.file_contracts[node].i] = ""
                            var links = ""
                            if (!data.file_contracts[node].m) {
                                data.file_contracts[node].autoRenew = false
                                data.file_contracts[node].m = ""
                                this.newMeta[data.file_contracts[node].i] = {
                                    contract: {
                                        autoRenew: false,
                                        encrypted: false,
                                        m: "",
                                    }
                                }
                                var filesNames = data.file_contracts[node]?.df ? Object.keys(data.file_contracts[node].df) : []
                                filesNames = filesNames.sort((a, b) => {
                                    if (a > b) return 1
                                    else if (a < b) return -1
                                    else return 0
                                })
                                for(var i = 0; i < filesNames.length; i++){
                                    this.newMeta[data.file_contracts[node].i][filesNames[i]] = {
                                        name: '',
                                        type: '',
                                        thumb: '',
                                        flags: '',
                                        is_thumb: false,
                                        encrypted: false,
                                        license: '',
                                        labels: '',
                                        size: data.file_contracts[node].df[filesNames[i]]
                                    }
                                    this.usedBytes += data.file_contracts[node].df[filesNames[i]]
                                    links += `![File ${i + 1}](https://ipfs.dlux.io/ipfs/${filesNames[i]})\n`
                                }
                            } else {
                                if (data.file_contracts[node].m.indexOf('"') >= 0) data.file_contracts[node].m = JSON.parse(data.file_contracts[node].m)
                                var encData = data.file_contracts[node].m.split(',')[0] || ''
                                var renew  = this.Base64toNumber(encData[0] || '0') & 1 ? true : false
                                var encAccounts = []
                                var encrypted = false
                                if(encData){
                                    encData = encData.split('#')
                                    renew = this.Base64toNumber(encData.shift()) & 1 ? true : false
                                    if(encData.length){
                                        encData = '#' + encData.join('#') 
                                        encAccounts = encData.split(';')
                                        encrypted = true
                                    }
                                }
                                this.newMeta[data.file_contracts[node].i] = {
                                    contract: {
                                        autoRenew: renew,
                                        encrypted,
                                        m: data.file_contracts[node].m,
                                    }
                                }
                                for (var i = 0; i < encAccounts.length; i++) {
                                    const encA = encAccounts[i].split('@')[1]
                                    data.file_contracts[node].autoRenew = renew
                                    data.file_contracts[node].encryption.accounts[encA] = {
                                        enc_key: `#${encAccounts[i].split('@')[0].split('#')[1]}`,
                                        key: '',
                                        done: true,
                                    }
                                }
                                
                                var filesNames = data.file_contracts[node]?.df ? Object.keys(data.file_contracts[node].df) : []
                                filesNames = filesNames.sort((a, b) => {
                                    if (a > b) return 1
                                    else if (a < b) return -1
                                    else return 0
                                })
                                const slots = data.file_contracts[node].m.split(",")
                                for(var i = 0; i < filesNames.length; i++){
                                    this.usedBytes += data.file_contracts[node].df[filesNames[i]]
                                    const flags = slots[i * 4 + 4]
                                    this.newMeta[data.file_contracts[node].i][filesNames[i]] = {
                                        name: slots[i * 4 + 1],
                                        type: slots[i * 4 + 2],
                                        thumb: slots[i * 4 + 3],
                                        thumb_data: slots[i * 4 + 3],
                                        flags: flags.indexOf('-') >= 0 ? flags.split('-')[0] : flags[0],
                                        license: flags.indexOf('-') >= 0 ? flags.split('-')[1] : '',
                                        labels: flags.indexOf('-') >= 0 ? flags.split('-')[2] : flags.slice(1),
                                    }
                                    if(this.newMeta[data.file_contracts[node].i][filesNames[i]].thumb)this.getImgData(data.file_contracts[node].i, filesNames[i])
                                    if(this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 1) this.newMeta[data.file_contracts[node].i][filesNames[i]].encrypted = true
                                    else this.newMeta[data.file_contracts[node].i][filesNames[i]].encrypted = false
                                    if(this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 2) this.newMeta[data.file_contracts[node].i][filesNames[i]].is_thumb = true
                                    else this.newMeta[data.file_contracts[node].i][filesNames[i]].is_thumb = false
                                    if(this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 4) this.newMeta[data.file_contracts[node].i][filesNames[i]].nsfw = true
                                    else this.newMeta[data.file_contracts[node].i][filesNames[i]].nsfw = false
                                    links += `![${this.newMeta[data.file_contracts[node].i][filesNames[i]].name}](https://ipfs.dlux.io/ipfs/${filesNames[i]})\n`
                                }
                            }
                            this.links[data.file_contracts[node].i] = links
                            this.contractIDs[data.file_contracts[node].i] = data.file_contracts[node];

                            this.contracts.push(data.file_contracts[node]);
                            this.contractIDs[data.file_contracts[node].i].index = this.contracts.length - 1;
                            this.postBodyAdder[data.file_contracts[node].i] = {}

                        }
                        for (var user in data.channels) {
                            for (var node in data.channels[user]) {
                                if (this.contractIDs[data.channels[user][node].i]) continue
                                else {
                                    this.contractIDs[data.channels[user][node].i] = data.channels[user][node];
                                    this.contracts.push(data.channels[user][node]);
                                    this.contractIDs[data.channels[user][node].i].index = this.contracts.length - 1;
                                }
                            }
                        }
                        this.sortContracts()
                    }
                    this.saccountapi = data;
                    this.saccountapi.spk += this.reward_spk();
                    if (!this.saccountapi.granted.t) this.saccountapi.granted.t = 0;
                    if (!this.saccountapi.granting.t) this.saccountapi.granting.t = 0;
                    this.availableBytes = data.spk_power * 1000 * 1024 * 6
                    this.spkval =
                        (data.balance +
                            data.gov +
                            data.poweredUp +
                            data.spk_power + 
                            this.saccountapi.granting.t +
                            data.claim +
                            data.spk) /
                        1000;
                });
        },
        getSpkStats() {
            fetch(this.sapi + "/stats")
                .then((response) => response.json())
                .then((data) => {
                    //console.log(data);
                    this.loaded = true;
                    this.spkStats = data.result;
                    for (var i = 0; i < this.tokenGov.options.length; i++) {
                        this.tokenGov.options[i].val = data.result[this.tokenGov.options[i].id]
                        this.tokenGov.options[i].range_high = parseFloat(this.tokenGov.options[i].val * 1.01).toFixed(6)
                        this.tokenGov.options[i].range_low = parseFloat(this.tokenGov.options[i].val * 0.99).toFixed(6)
                        this.tokenGov.options[i].step = "0.000001"
                    }
                    this.getSapi()
                });
        },
        handleLabel(id, cid, m) {
            if (m.action == 'added') {
                if (this.newMeta[id][cid].labels.indexOf(m.item) == -1 ) this.newMeta[id][cid].labels += m.item
            } else {
                this.newMeta[id][cid].labels = this.newMeta[id][cid].labels.replace(m.item, '')
            }
        },
        handlePropContracts(contract){
            if(this.larynxbehind == 999999){
                setTimeout(() => {
                    this.handlePropContracts(contract)
                }, 1000)
            } else {
                const data = {
                    file_contracts: [contract]
                }
                for (var node in data.file_contracts) {
                    if(data.file_contracts[node].u > this.filter.size) this.filter.size = data.file_contracts[node].u
                    data.file_contracts[node].sm = 1
                    data.file_contracts[node].encryption = {
                        input: "",
                        key: "",
                        accounts: {},
                    }
                    this.links[data.file_contracts[node].i] = ""
                    var links = ""
                    if (!data.file_contracts[node].m) {
                        data.file_contracts[node].autoRenew = false
                        data.file_contracts[node].m = ""
                        this.newMeta[data.file_contracts[node].i] = {
                            contract: {
                                autoRenew: false,
                                encrypted: false,
                                m: "",
                            }
                        }
                        var filesNames = data.file_contracts[node]?.df ? Object.keys(data.file_contracts[node].df) : []
                        filesNames = filesNames.sort((a, b) => {
                            if (a > b) return 1
                            else if (a < b) return -1
                            else return 0
                        })
                        for(var i = 0; i < filesNames.length; i++){
                            this.newMeta[data.file_contracts[node].i][filesNames[i]] = {
                                name: '',
                                type: '',
                                thumb: '',
                                flags: '',
                                is_thumb: false,
                                encrypted: false,
                                license: '',
                                labels: '',
                                size: data.file_contracts[node].df[filesNames[i]]
                            }
                            this.usedBytes += data.file_contracts[node].df[filesNames[i]]
                            links += `![File ${i + 1}](https://ipfs.dlux.io/ipfs/${filesNames[i]})\n`
                        }
                    } else {
                        if (data.file_contracts[node].m.indexOf('"') >= 0) data.file_contracts[node].m = JSON.parse(data.file_contracts[node].m)
                        var encData = data.file_contracts[node].m.split(',')[0] || ''
                        var renew  = this.Base64toNumber(encData[0] || '0') & 1 ? true : false
                        var encAccounts = []
                        var encrypted = false
                        if(encData){
                            encData = encData.split('#')
                            renew = this.Base64toNumber(encData.shift()) & 1 ? true : false
                            if(encData.length){
                                encData = '#' + encData.join('#') 
                                encAccounts = encData.split(';')
                                encrypted = true
                            }
                        }
                        this.newMeta[data.file_contracts[node].i] = {
                            contract: {
                                autoRenew: renew,
                                encrypted,
                                m: data.file_contracts[node].m,
                            }
                        }
                        for (var i = 0; i < encAccounts.length; i++) {
                            const encA = encAccounts[i].split('@')[1]
                            data.file_contracts[node].autoRenew = renew
                            data.file_contracts[node].encryption.accounts[encA] = {
                                enc_key: `#${encAccounts[i].split('@')[0].split('#')[1]}`,
                                key: '',
                                done: true,
                            }
                        }
                        
                        var filesNames = data.file_contracts[node]?.df ? Object.keys(data.file_contracts[node].df) : []
                        filesNames = filesNames.sort((a, b) => {
                            if (a > b) return 1
                            else if (a < b) return -1
                            else return 0
                        })
                        const slots = data.file_contracts[node].m.split(",")
                        for(var i = 0; i < filesNames.length; i++){
                            this.usedBytes += data.file_contracts[node].df[filesNames[i]]
                            const flags = slots[i * 4 + 4]
                            this.newMeta[data.file_contracts[node].i][filesNames[i]] = {
                                name: slots[i * 4 + 1],
                                type: slots[i * 4 + 2],
                                thumb: slots[i * 4 + 3],
                                thumb_data: slots[i * 4 + 3],
                                flags: flags.indexOf('-') >= 0 ? flags.split('-')[0] : flags[0],
                                license: flags.indexOf('-') >= 0 ? flags.split('-')[1] : '',
                                labels: flags.indexOf('-') >= 0 ? flags.split('-')[2] : flags.slice(1),
                            }
                            if(this.newMeta[data.file_contracts[node].i][filesNames[i]].thumb)this.getImgData(data.file_contracts[node].i, filesNames[i])
                            if(this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 1) this.newMeta[data.file_contracts[node].i][filesNames[i]].encrypted = true
                            else this.newMeta[data.file_contracts[node].i][filesNames[i]].encrypted = false
                            if(this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 2) this.newMeta[data.file_contracts[node].i][filesNames[i]].is_thumb = true
                            else this.newMeta[data.file_contracts[node].i][filesNames[i]].is_thumb = false
                            if(this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 4) this.newMeta[data.file_contracts[node].i][filesNames[i]].nsfw = true
                            else this.newMeta[data.file_contracts[node].i][filesNames[i]].nsfw = false
                            links += `![${this.newMeta[data.file_contracts[node].i][filesNames[i]].name}](https://ipfs.dlux.io/ipfs/${filesNames[i]})\n`
                        }
                    }
                    this.links[data.file_contracts[node].i] = links
                    this.contractIDs[data.file_contracts[node].i] = data.file_contracts[node];

                    this.contracts.push(data.file_contracts[node]);
                    this.contractIDs[data.file_contracts[node].i].index = this.contracts.length - 1;
                    this.postBodyAdder[data.file_contracts[node].i] = {}

                }
                for (var user in data.channels) {
                    for (var node in data.channels[user]) {
                        if (this.contractIDs[data.channels[user][node].i]) continue
                        else {
                            this.contractIDs[data.channels[user][node].i] = data.channels[user][node];
                            this.contracts.push(data.channels[user][node]);
                            this.contractIDs[data.channels[user][node].i].index = this.contracts.length - 1;
                        }
                    }
                }
                this.sortContracts()
            }
        },
        handleLicense(id, cid, m) {
            if (m.action == 'added') {
                this.newMeta[id][cid].license = m.item
            } else {
                this.newMeta[id][cid].license = ''
            }
        },
        handleTag(id, cid, m) {
            var num = this.Base64toNumber(this.newMeta[id][cid].flags) || 0
            if (m.action == 'added') {
                if (num & m.item) { }
                else num += m.item
                this.newMeta[id][cid].flags = (this.NumberToBase64(num) || "0")
                switch (m.item){
                    case 1:
                        this.newMeta[id][cid].encrypted = true
                        break
                    case 2:
                        this.newMeta[id][cid].is_thumb = true
                        break
                    case 4:
                        this.newMeta[id][cid].nsfw = true
                        break
                    default:
                }
            } else {
                if (num & m.item) num -= m.item
                this.newMeta[id][cid].flags = (this.NumberToBase64(num) || "0")
                switch (m.item){
                    case 1:
                        this.newMeta[id][cid].encrypted = false
                        break
                    case 2:
                        this.newMeta[id][cid].is_thumb = false
                        break
                    case 4:
                        this.newMeta[id][cid].nsfw = false
                        break
                    default:
                }
            }
        },
        NumberToBase64(num) {
            const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
            var result = "";
            while (num > 0) {
                result = glyphs[num % 64] + result;
                num = Math.floor(num / 64);
            }
            return result;
        },
        when(arr) {
            if (!arr.length) return "";
            var seconds =
                (parseInt(arr[0]) - parseInt(this.saccountapi.head_block)) * 3;
            var interval = Math.floor(seconds / 86400);
            if (interval >= 1) {
                return interval + ` day${interval > 1 ? "s" : ""}`;
            }
            interval = Math.floor(seconds / 3600);
            if (interval >= 1) {
                return interval + ` hour${interval > 1 ? "s" : ""}`;
            }
            interval = Math.floor(seconds / 60);
            if (interval >= 1) {
                return `${interval} minute${interval > 1 ? "s" : ""}`;
            }
            return Math.floor(seconds) + " seconds";
        },
        reward_spk() {
            var r = 0,
                a = 0,
                b = 0,
                c = 0,
                t = 0,
                diff = (this.saccountapi.head_block ? this.saccountapi.head_block : this.sstats.lastIBlock) - this.saccountapi.spk_block;
            //console.log(diff, this.saccountapi.head_block , this.sstats)
            if (!this.saccountapi.spk_block) {
                //console.log("No SPK seconds");
                return 0;
            } else if (diff < 28800) {
                //console.log("Wait for SPK");
                return 0;
            } else {
                t = parseInt(diff / 28800);
                a = this.saccountapi.gov
                    ? simpleInterest(this.saccountapi.gov, t, this.sstats.spk_rate_lgov)
                    : 0;
                b = this.saccountapi.pow
                    ? simpleInterest(this.saccountapi.pow, t, this.sstats.spk_rate_lpow)
                    : 0;
                c = simpleInterest(
                    parseInt(
                        this.saccountapi.granted?.t > 0 ? this.saccountapi.granted.t : 0
                    ) +
                    parseInt(
                        this.saccountapi.granting?.t > 0 ? this.saccountapi.granting.t : 0
                    ),
                    t,
                    this.sstats.spk_rate_ldel
                );
                const i = a + b + c;
                if (i) { return i } else { return 0 }
            }
            function simpleInterest(p, t, r) {
                const amount = p * (1 + parseFloat(r) / 365);
                const interest = amount - p;
                return parseInt(interest * t);
            }
        },
        selectContract(id, broker) {  //needs PeerID of broker
            this.contract.id = id
            fetch(`${this.sapi}/user_services/${broker}`)
                .then(r => r.json())
                .then(res => {
                    this.contract.api = res.services.IPFS[Object.keys(res.services.IPFS)[0]].a
                })
        },
        extend(contract, amount) {
            if (amount > this.broca_calc(this.broca)) return
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
        store(contracts, remove = false) {
            // have a storage node?
            if(typeof contracts == "string")contracts = [contracts]
            const toSign = {
                type: "cja",
                cj: {
                    items: contracts
                },
                id: `spkccT_${!remove ? 'store' : 'remove'}`,
                msg: `Storing ${contract}...`,
                ops: ["getTokenUser"],
                api: "https://spktest.dlux.io",
                txid: `${contract}_${!remove ? 'store' : 'remove'}`,
            }
            this.$emit('tosign', toSign)
        },
        storeAll(){
            var contracts = []
            for(var i = 0; i < this.contracts.length; i++){
                if(this.contracts[i].sm == 1)contracts.push(this.contracts[i].i)
            }
            this.store(this.contracts[i].i)
        },
        filterSize(){
            for(var i = 0; i < this.contracts.length; i++){
                if(this.isStored(this.contracts[i].i))this.contracts[i].sm = 0
                if(this.contracts[i].u < this.filter.size)this.contracts[i].sm = 1
                else this.contracts[i].sm = 0
            }
            this.filterSlots
        },
        filterSlots(){
            if(this.filterSize.slot) for(var i = 0; i < this.contracts.length; i++){
                if(this.isStored(this.contracts[i].i))this.contracts[i].sm = 0
                if(!Object.keys(this.contracts[i].n).length < this.contracts[i].p && this.contracts[i].sm == 1)this.contracts[i].sm = 1
                else this.contracts[i].sm = 0
            }
        },
        getContracts() {
            var contracts = [],
                getContract = (id) => {
                    fetch('https://spktest.dlux.io/api/fileContract/' + id)
                        .then((r) => r.json())
                        .then((res) => {
                            res.result.extend = "7"
                            if (res.result) {
                                this.contracts[id] = res.result
                                if (res.result.c == 2) {
                                    this.state2contracts.push(res.result.s)
                                }
                                //this.extendcost[id] = parseInt(res.result.extend / 30 * res.result.r)
                            }
                        });
                }
            for (var contract in this.post.contract) {
                contracts.push(contract)
            }
            contracts = [...new Set(contracts)]
            for (var i = 0; i < contracts.length; i++) {
                getContract(contracts[i])
            }
        },
        addBen(s) {
            console.log(s)
            this.$emit('bens', { account: s.split(',')[0], weight: s.split(',')[1] })
        },
        getIPFSproviders() {
            fetch("https://spktest.dlux.io/services/IPFS")
                .then((response) => response.json())
                .then((data) => {
                    this.ipfsProviders = data.providers
                });
        },
        imgUrlAlt(event) {
            event.target.src = "/img/dlux-logo-icon.png";
        },
        picFind(json) {
            var arr;
            try {
                arr = json.image[0];
            } catch (e) { }
            if (typeof json.image == "string") {
                return json.image;
            } else if (typeof arr == "string") {
                return arr;
            } else if (typeof json.Hash360 == "string") {
                return `https://ipfs.dlux.io/ipfs/${json.Hash360}`;
            } else {
                /*
                        var looker
                        try {
                            looker = body.split('![')[1]
                            looker = looker.split('(')[1]
                            looker = looker.split(')')[0]
                        } catch (e) {
                            */
                return "/img/dluxdefault.png";
            }
        },
        pending(event) {
            this.mde = event
        },
        vote(url) {
            this.$emit('vote', { url: `/@${this.post.author}/${this.post.permlink}`, slider: this.slider, flag: this.flag })
        },
        color_code(name) {
            return parseInt(this.contracts[name] ? this.contracts[name].e.split(':')[0] : 0) - this.head_block
        },
        timeSince(date) {
            var seconds = Math.floor((new Date() - new Date(date + ".000Z")) / 1000);
            var interval = Math.floor(seconds / 86400);
            if (interval > 7) {
                return new Date(date).toLocaleDateString();
            }
            if (interval >= 1) {
                return interval + ` day${interval > 1 ? "s" : ""} ago`;
            }
            interval = Math.floor(seconds / 3600);
            if (interval >= 1) {
                return interval + ` hour${interval > 1 ? "s" : ""} ago`;
            }
            interval = Math.floor(seconds / 60);
            if (interval >= 1) {
                return `${interval} minute${interval > 1 ? "s" : ""} ago`;
            }
            return Math.floor(seconds) + " seconds ago";
        },
        setReply(event) {
            this.mde = event
        },
        reply(deets) {
            if (!deets) deets = {
                "parent_author": this.post.author,
                "parent_permlink": this.post.permlink,
                "author": this.account,
                "permlink": 're-' + this.post.permlink,
                "title": '',
                "body": this.mde,
                "json_metadata": JSON.stringify(this.postCustom_json)
            }
            this.$emit('reply', deets)
        },
        broca_calc(last = '0,0') {
            if (!last) last = '0,0'
            const last_calc = this.Base64toNumber(last.split(',')[1])
            const accured = parseInt((parseFloat(this.saccountapi.broca_refill || 144000) * (this.saccountapi.head_block - last_calc)) / (this.saccountapi.spk_power * 1000))
            var total = parseInt(last.split(',')[0]) + accured
            if (total > (this.saccountapi.spk_power * 1000)) total = (this.saccountapi.spk_power * 1000)
            return total
        },
        Base64toNumber(chars = "") {
            if (typeof chars != 'string') {
                console.log({ chars })
                return 0
            }
            const glyphs =
                "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
            var result = 0;
            chars = chars.split("");
            for (var e = 0; e < chars.length; e++) {
                result = result * 64 + glyphs.indexOf(chars[e]);
            }
            return result;
        },
        formatNumber(t = 1, n, r, e) { // number, decimals, decimal separator, thousands separator
            if (typeof t != "number") {
                const parts = t ? t.split(" ") : []
                var maybe = 0
                for (i = 0; i < parts.length; i++) {
                    if (parseFloat(parts[i]) > 0) {
                        maybe += parseFloat(parts[i])
                    }
                }
                if (maybe > parseFloat(t)) {
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
                for (var c = /(\d+)(\d{3})/; c.test(i);)
                    i = i.replace(c, "$1" + e + "$2");
            return (u ? "-" : "") + i + o;
        },
        gt(a, b) {
            return parseFloat(a) > parseFloat(b);
        },
        precision(num, precision) {
            return parseFloat(num / Math.pow(10, precision)).toFixed(precision);
        },
        toFixed(n, digits) {
            return parseFloat(n).toFixed(digits)
        },
        hideLowRep() {
            if (this.post.rep != '...') {
                if (parseFloat(this.post.rep) < 25) {
                    this.view = false;
                    this.warn = true;
                }
            } else {
                setTimeout(this.hideLowRep, 1000)
            }
        },
        unkeyed(obj) {
            if (!obj) return false
            if (!this.contracts[this.contractIDs[obj].index].encryption) return false
            for (var node in this.contracts[this.contractIDs[obj].index].encryption.accounts) {
                if (!this.contracts[this.contractIDs[obj].index].encryption.accounts[node].enc_key) return true
            }
            return false
        },
        setRating(rating) {
            this.post.rating = rating;
        },
        fancyBytes(bytes) {
            var counter = 0, p = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
            while (bytes > 1024) {
                bytes = bytes / 1024
                counter++
            }
            return `${this.toFixed(bytes, 2)} ${p[counter]}B`
        },
        expIn(con) {
            return `Expires in ${parseInt((parseInt(con.e.split(':')[0]) - this.head_block) / 20 / 60) < 24 ? parseInt((parseInt(con.e.split(':')[0]) - this.head_block) / 20 / 60) + ' hours' : parseInt((parseInt(con.e.split(':')[0]) - this.head_block) / 20 / 60 / 24) + ' days'}`
        },
        cancel_contract(contract) {
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
        },
        isStored(cid) {
              var found = false
              for (var i in this.contractIDs[cid].n) {
                  if (this.contractIDs[cid].n[i] == this.account) {
                      found = true
                      break
                  }
              }
              return found
        },
    },
    watch: {
        'account'(newValue) {
            if (this.loaded == true) {
                if (!this.nodeview) {
                    this.contracts = []
                    this.contractIDs = {}
                }
                this.saccountapi = {
                    spk: 0,
                    balance: 0,
                    gov: 0,
                    poweredUp: 0,
                    claim: 0,
                    granted: {
                        t: 0
                    },
                    granting: {
                        t: 0
                    }
                },
                    this.getSpkStats()
            }
        },
        'toSign'(newValue) {
            if (newValue.type) {
                this.$emit('tosign', this.toSign)
                this.toSign = {}
            }
        },
        'prop_contracts'(newValue) {
            if (this.nodeview) {
                this.contracts = []
                this.contractIDs = {}
                const getContract = (id) => {
                    fetch('https://spktest.dlux.io/api/fileContract/' + id)
                        .then((r) => r.json())
                        .then((res) => {
                            res.result.extend = "7"
                            if (res.result) {
                                this.handlePropContracts(res.result)
                                //this.pcontracts.splice(this.contractIDs[id].index, 1, res.result)
                                //this.extendcost[id] = parseInt(res.result.extend / 30 * res.result.r)
                            }
                        });
                }
                var i = 0
                for (var node in this.prop_contracts) {
                    // this.pcontracts.push(this.prop_contracts[node]);
                    // this.pcontractIDs[this.prop_contracts[node].i] = this.prop_contracts[node];
                    // this.pcontractIDs[this.prop_contracts[node].i].index = i
                    // i++
                    getContract(this.prop_contracts[node].i)
                }
            }
        }
    },
    computed: {
        hasFiles() {
            return Object.keys(this.files).length > 0;
        },
    },
    mounted() {
        this.getSpkStats()
        this.getIPFSproviders()
        this.contracts = []
        this.contractIDs = {}
        const getContract = (id) => {
            fetch('https://spktest.dlux.io/api/fileContract/' + id)
                .then((r) => r.json())
                .then((res) => {
                    res.result.extend = "7"
                    if (res.result) {
                        this.handlePropContracts(res.result)
                        //this.pcontracts.splice(this.contractIDs[id].index, 1, res.result)
                        //this.extendcost[id] = parseInt(res.result.extend / 30 * res.result.r)
                    }
                });
        }
        //var i = 0
        for (var node in this.prop_contracts) {
            // this.pcontracts.push(this.prop_contracts[node]);
            // this.pcontractIDs[this.prop_contracts[node].i] = this.prop_contracts[node];
            // this.pcontractIDs[this.prop_contracts[node].i].index = i
            // i++
            getContract(this.prop_contracts[node].i)
        }
    },
};