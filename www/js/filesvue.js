import ChoicesVue from '/js/choices-vue.js';
import Pop from "/js/pop-min.js";

export default {
    components: {
        "pop-vue": Pop,
        "choices-vue": ChoicesVue
    },
    template: `
<div class="d-flex flex-grow-1 flex-column rounded">
    <div class="pt-1">
        <!-- USER INPUT -->
            <div v-if="cc" class="d-flex flex-column flex-grow-1 mb-1 mx-1">
                <label class="fs-5 fw-light mb-1">View other users' files, use <i class="fa-brands fa-creative-commons fa-fw"></i> and <i class="fa-brands fa-creative-commons-zero fa-fw"></i> licensed files, and decrypt files that have been shared with you</label>
                <div class="d-flex">
                    <div class="position-relative flex-grow-1">
                        <span class="position-absolute top-50 translate-middle-y ps-2"><i
                                class="fa-solid fa-at fa-fw"></i></span>
                        <input 
                            class="ps-4 mb-1 form-control border-white" type="search"
                            placeholder="username" @blur="appendUserFiles()" v-model="newUser">
                    </div>
                    <div class="ms-1">
                            <div class="btn btn-lg btn-light" @click="appendUserFiles()"><i class="fa-solid fa-fw fa-plus"></i>
                            </div>
                        </div>
                </div>
                
                <div class="d-flex flex-wrap d-xl-flex mb-1" v-if="owners.length > 1">
                <!-- Active Filters -->
                <div v-for="owner in owners" class="btn-group btn-group me-1 mb-1" style="height:50px">
                    <a :href="'/@' + owner" target="_blank" class="btn btn-light rounded-start align-content-center">
                        <span>{{owner}}</span>
                    </a>
                    <button type="button" class="btn btn-dark ms-0 me-0 ps-0 pe-0" disabled>
                    </button>
                    <button type="button" @click="cycleView(owner)" class="btn btn-light px-2">
                        <i class="fa-solid fa-fw" :class="{'fa-eye': filesSelect.addusers[owner] === true, 'fa-eye-slash': filesSelect.addusers[owner] === false, 'fa-lock': filesSelect.addusers[owner] == 'lock', 'fa-brands fa-creative-commons': filesSelect.addusers[owner] == 'cc'}"></i>
                        <i class="fa-solid fa-eye-slash fa-fw d-none"></i>
                    </button>
                    <button type="button" class="btn btn-dark ms-0 me-0 ps-0 pe-0" disabled>
                    </button>
                    <button @click="purge(owner)" type="button" class="btn btn-light px-2">
                        <i class="fa-solid fa-xmark fa-fw"></i>
                    </button>
                </div>

                <button @click="clearFilters()" type="button"
                    class="btn btn-secondary mb-1 d-none">
                    Clear All
                </button>
                
            </div>
            </div>

            

        <!-- ACTION BAR -->
        <div class="d-flex border-bottom border-white-50">
            <div class="d-flex flex-wrap align-items-center justify-content-center mx-1 flex-grow-1">
                
                <!-- Search -->
                <div class="position-relative flex-grow-1 mb-1 me-1">
                    <span class="position-absolute top-50 translate-middle-y ps-2"><i
                            class="fa-solid fa-magnifying-glass fa-fw"></i></span>
                    <input @keyup="render()" @change="render()" @search="render()"
                        class="ps-4 form-control border-white" type="search"
                        placeholder="Search filename" v-model="filesSelect.search">
                </div>

                <!-- choices-js-->
                <div class=" mb-1 mx-1" style="min-width: 300px !important;">

                    <choices-vue ref="select-tag" :prop_selections="filterFlags" prop_function="search" prop_type="tags" @data="handleTag($event)"></choices-vue>
                </div>
                <div class="mb-1 mx-1" style="min-width: 300px !important;">

                    <choices-vue ref="select-label" :prop_selections="filterLabels" prop_function="search" prop_type="labels" @data="handleLabel($event)"></choices-vue>
                </div> 

                <!-- Sort -->
                <div class="dropdown mb-1">
                    <button class="btn btn-outline-light w-100" type="button" data-bs-toggle="dropdown"
                        aria-expanded="false"><i class="fa-solid fa-sort fa-fw ms-1"></i>
                        {{filesSelect.sort.charAt(0).toUpperCase() + filesSelect.sort.slice(1)}} {{filesSelect.dir == 'asc' ? 'Ascending' : 'Descending'}}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end bg-black">
                        <li>
                            <a @click="filesSelect.dir='asc';filesSelect.sort='time';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-calendar-days fa-fw me-1"></i>Created<i class="fa-solid fa-caret-up fa-fw ms-auto"></i></a>
                        </li>
                            <li>
                            <a @click="filesSelect.dir='dec';filesSelect.sort='time';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-calendar-days fa-fw me-1"></i>Created<i class="fa-solid fa-caret-down fa-fw ms-auto"></i></a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a @click="filesSelect.dir='asc';filesSelect.sort='exp';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-clock fa-fw me-1"></i><span class="me-1">Expiration</span><i class="fa-solid fa-caret-up fa-fw ms-auto"></i></a>
                        </li>
                        <li>
                            <a @click="filesSelect.dir='dec';filesSelect.sort='exp';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-clock fa-fw me-1"></i><span class="me-1">Expiration</span><i class="fa-solid fa-caret-down fa-fw ms-auto"></i></a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a @click="filesSelect.dir='asc';filesSelect.sort='size';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-database fa-fw me-1"></i>Size<i class="fa-solid fa-caret-up fa-fw ms-auto"></i></a>
                        </li>
                        <li>
                            <a @click="filesSelect.dir='dec';filesSelect.sort='size';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-database fa-fw me-1"></i>Size<i class="fa-solid fa-caret-down fa-fw ms-auto"></i></a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a @click="filesSelect.dir='dec';filesSelect.sort='name';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-file fa-fw me-1"></i>Name<i class="fa-solid fa-caret-up fa-fw ms-auto"></i></a>
                        </li>
                        <li>
                            <a @click="filesSelect.dir='asc';filesSelect.sort='name';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-file fa-fw me-1"></i>Name<i class="fa-solid fa-caret-down fa-fw ms-auto"></i></a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a @click="filesSelect.dir='asc';filesSelect.sort='type';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-layer-group fa-fw me-1"></i>Type<i class="fa-solid fa-caret-up fa-fw ms-auto"></i></a>
                        </li>
                        <li>
                            <a @click="filesSelect.dir='dec';filesSelect.sort='type';render()"
                                class="dropdown-item d-flex align-items-center" role="button"><i class="fa-solid fa-layer-group fa-fw me-1"></i>Type<i class="fa-solid fa-caret-down fa-fw ms-auto"></i></a>
                        </li>
                        
                    </ul>
                </div>

            </div>
        </div>

        

        <div class="d-flex align-items-center my-1 mx-1">
            <h5 class="mb-0"> {{filesArray.length}} File{{filesArray.length == 1 ? '' : 's'}}</h5>
            <div class="ms-auto">
                <div class="btn-group">
                    <input type="radio" class="btn-check" :name="'smView' + (cc ? 'cc' : '')" :id="'setSingle' + (cc ? 'cc' : '')" autocomplete="off" @click="viewOpts.list = true" :checked="viewOpts.list" />
                    <label class="btn btn-outline-warning" :for="'setSingle' + (cc ? 'cc' : '')"><i
                            class="fa-solid fa-table-list fa-fw"></i></label>
                    <input type="radio" class="btn-check" :name="'smView' + (cc ? 'cc' : '')" :id="'setDouble' + (cc ? 'cc' : '')" autocomplete="off" @click="viewOpts.list = false"
                        :checked="!viewOpts.list" />
                    <label class="btn btn-outline-warning" :for="'setDouble' + (cc ? 'cc' : '')"><i
                            class="fa-solid fa-table-cells-large fa-fw"></i></label>
                </div>
            </div>
        </div>
    </div>

    <div class="bg-dark rounded-bottom">

        <div class="text-center" role="table" aria-label="Files" v-if="viewOpts.list">
            <div class="d-flex flex-wrap align-items-center fw-bold justify-content-end border-top border-start border-end border-dark" role="rowgroup" style="background-color: #1976D2">
                <div class="py-1 border-bottom border-dark" role="columnheader" style="width:70px">&nbsp;</div>
                <div class="py-1 border-start border-bottom border-dark flex-grow-1 first" role="columnheader" style="max-width:480px">Filename</div>
                <div class="py-1 border-start border-bottom border-dark" role="columnheader" style="width:150px">Tags & Labels</div>
                <div class="py-1 border-start border-bottom border-dark" role="columnheader" style="width:150px">Owner</div>
                <div class="py-1 border-start border-bottom border-dark" role="columnheader" style="width:80px">Size</div>
                <div class="py-1 border-start border-bottom border-dark" role="columnheader" style="width:100px">Created</div>
                <div class="py-1 border-start border-bottom border-dark" role="columnheader" style="width:146px">Expiration</div>
                <div class="py-1 border-start border-bottom border-dark" role="columnheader" style="width:120px">&nbsp;</div>
            </div>
            <div class="flex-table d-flex flex-wrap align-items-center justify-content-end" role="rowgroup" v-for="file in filesArray">
                <div class="" role="cell">
                    <div style="width: 70px;">
                        
                            
                        <div class="bg-light position-relative rounded first m-1" style="width: 50px;">
                            <div v-if="flagsDecode(newMeta[file.i][file.f].flags, 1).length" class="position-absolute bottom-0 end-0 bg-dark rounded-circle small px-05">
                                <i class="fa-solid fa-lock"></i>
                            </div>
                            <img v-if="newMeta[file.i][file.f].thumb" class="img-fluid rounded" :src="newMeta[file.i][file.f].thumb_data"  >
                            <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                    viewBox="0 0 800 800" style="enable-background:new 0 0 800 800;" xml:space="preserve">
                                <g>
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
                                    <text transform="matrix(1 0 0 1 233.3494 471.9725)" class="st1 st2" style="text-transform: uppercase; font-size: 149px;">{{newMeta[file.i][file.f].type}}</text>
                                </g>
                            </svg>
                        </div>
                     
                    </div>
                </div>
                <div class="flex-grow-1 first" role="cell">
                    <div style="max-width:480px;">
                        <div class="text-start text-break m-1">{{newMeta[file.i][file.f].name || file.f}}{{newMeta[file.i][file.f].thumb ? '.' + newMeta[file.i][file.f].type : ''}}</div>
                    </div>
                </div>
               
                <div class="" role="cell">
                    <div style="width:150px;">
                        <div class="d-flex flex-wrap align-items-center justify-content-center bg-darkg rounded px-1 py-05 m-1">
                            <div>&nbsp;</div>
                            <!-- colors -->
                            <div v-if="file.lc" class="d-flex me-1 align-items-center" style="margin-left: 15px">
                                    <i v-for="(color, num) in labelsDecode(file.lc)" :class="color.fa" :style="'margin-left: ' + -15 +'px !important;'"></i>
                            </div>
                            <!-- labels -->
                            <div class="me-1" v-for="label in labelsDecode(file.ll)">
                                <span class="d-flex align-items-center">
                                    <pop-vue :id="'popperL-' + file.i + file.index + label.l + (cc ? 'cc' : '')" :title="label.l" trigger="hover">
                                        <i :class="label.fa"></i>
                                    </pop-vue>
                                </span>
                            </div>
                            <!-- flags -->
                            <div class="d-flex align-items-center">
                            <div v-for="flag in flagsDecode(newMeta[file.i][file.f].flags, 0, 3)" >
                                    <!-- title="Labels"  -->
                                    <pop-vue :id="'popper-' + file.i + file.index + flag.l + (cc ? 'cc' : '')" :title="flag.l" trigger="hover">
                                        <i :class="flag.fa"></i>
                                    </pop-vue>
                                </div>
                            </div>
                            <div>
                                <pop-vue v-if="licenses[file.lic]" v-for="lic in licenses[file.lic].fa" :id="'popper-Lic' + (cc ? 'cc' : '') + file.i + file.index + file.lic" :title="lic.l" trigger="hover">    
                                    <i :class="lic.fa"></i>
                                </pop-vue>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="" role="cell"><div style="width:150px"><div class="m-1"><a :href="'/@' + contract[file.i].t">@{{contract[file.i].t}}</a></div></div></div>
                <div class="" role="cell"><div style="width:80px"><div class="m-1">{{fancyBytes(file.s)}}</div></div></div>
                <div class="" role="cell"><div style="width:100px"><div class="m-1">{{blockToTime(file.c)}}</div></div></div>
                <div class="">
                    <div style="width: 146px;" role="cell">
                        <div class="border rounded px-1 py-05 m-1" :class="{'border-success': newMeta[file.i].contract.autoRenew, 'border-warning': !newMeta[file.i].contract.autoRenew}">
                            {{blockToTime(file.e)}}
                            <i :class="{'text-success': newMeta[file.i].contract.autoRenew, 'text-warning': !newMeta[file.i].contract.autoRenew}" class="ms-05 fa-solid fa-arrows-rotate fa-fw"></i>
                        </div>
                    </div>
                </div>
                <div class="" role="cell">
                    <div class="" style="width: 120px;">
                            <div class="m-1">
                            <!-- link -->
                            <div v-if="!newMeta[file.i][file.f].encrypted">
                                <a :href="'https://ipfs.dlux.io/ipfs/' + file.f" target="_blank" class="w-100 btn btn-sm btn-info my-1 mx-auto"><span class="d-flex align-items-center">URL<i class="ms-auto fa-solid fa-fw fa-up-right-from-square"></i></span></a>
                            </div>
                            <!-- decrypt  -->
                            <div v-if="newMeta[file.i][file.f].encrypted && !contract[file.i].encryption.key">
                                <button type="button" class="w-100 btn btn-sm btn-primary my-1 mx-auto" @click="decode(file.i)"><span class="d-flex align-items-center w-100">Decrypt<i class="fa-solid fa-fw ms-auto fa-lock-open"></i></span></button>
                            </div>
                            <!-- download enc -->
                            <div v-if="newMeta[file.i][file.f].encrypted && contract[file.i].encryption.key">
                                <button type="button" class="w-100 btn btn-sm btn-primary my-1 mx-auto" @click="downloadFile(file.f, file.i)"><span class="d-flex align-items-center w-100">Download<i class="fa-solid fa-download fa-fw ms-auto"></i></span></button>
                            </div>
                            <!-- add to post -->
                            <div v-if="assets">
                                <button type="button" class="w-100 btn btn-sm btn-purp my-1 mx-auto" @click="addToPost(file.f, contract.i, index)"><span class="d-flex align-items-center w-100"><span class="d-sm-none">Add to</span> Post<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                            </div>
                            <!-- add to asset -->
                            <div v-if="assets">
                                <button type="button" class="w-100 btn btn-sm btn-purp my-1 mx-auto" @click="addAsset(file, contract)"><span class="d-flex align-items-center w-100"><span class="d-sm-none">Add to </span>Asset<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <p></p>

        <div class="d-none table-container" role="table" aria-label="Destinations" v-if="viewOpts.list">
            <div class="flex-table header" role="rowgroup">
                <div class="flex-row order-md-first" role="columnheader"></div>
                <div class="flex-row order-first first flex-grow-1" role="columnheader">Filename</div>
                <div class="flex-row" role="columnheader">Owner</div>
                <div class="flex-row" role="columnheader">Tags & Labels</div>
                <div class="flex-row" role="columnheader">Size</div>
                <div class="flex-row" role="columnheader">Created</div>
                <div class="flex-row" role="columnheader">Expiration</div>
                <div class="flex-row" role="columnheader"></div>
            </div>
            <div class="flex-table row" role="rowgroup" v-for="file in filesArray">
                <div class="flex-row order-md-first" role="cell">
                    <div class="bg-light mx-auto" style="width:50px;">
                        <img v-if="newMeta[file.i][file.f].thumb" class="mx-auto img-fluid rounded bg-light" :src="newMeta[file.i][file.f].thumb_data" width="50px" >
                        <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                viewBox="0 0 800 800" style="enable-background:new 0 0 800 800;" xml:space="preserve">
                            <g>
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
                                <text transform="matrix(1 0 0 1 233.3494 471.9725)" class="st1 st2" style="text-transform: uppercase; font-size: 149px;">{{newMeta[file.i][file.f].type}}</text>
                            </g>
                        </svg>
                    </div>
                </div>
                <div class="flex-row order-first first flex-grow-1" role="cell">{{newMeta[file.i][file.f].name || file.f}}{{newMeta[file.i][file.f].thumb ? '.' + newMeta[file.i][file.f].type : ''}}</div>
                <div class="flex-row " role="cell">@{{contract[file.i].t}}</div>
                <div class="flex-row" role="cell">
                    <div class="d-flex flex-wrap align-items-center justify-content-center">
                        <!-- colors -->
                        <div v-if="file.lc" class="d-flex me-1 align-items-center" style="margin-left: 15px">
                                <i v-for="(color, num) in labelsDecode(file.lc)" :class="color.fa" :style="'margin-left: ' + -15 +'px !important;'"></i>
                        </div>
                        <!-- labels -->
                        <div class="me-1" v-for="label in labelsDecode(file.ll)">
                            <span class="d-flex align-items-center">
                                <pop-vue :id="'popperL-' + file.i + file.index + label.l + (cc ? 'cc' : '')" :title="label.l" trigger="hover">
                                    <i :class="label.fa"></i>
                                </pop-vue>
                            </span>
                        </div>
                        <!-- flags -->
                        <div class="d-flex align-items-center">
                        <div v-for="flag in flagsDecode(newMeta[file.i][file.f].flags, 0, 3)" >
                                <!-- title="Labels"  -->
                                <pop-vue :id="'popper-' + file.i + file.index + flag.l + (cc ? 'cc' : '')" :title="flag.l" trigger="hover">
                                    <i :class="flag.fa"></i>
                                </pop-vue>
                            </div>
                        </div>
                        <div>
                            <pop-vue v-if="licenses[file.lic]" v-for="lic in licenses[file.lic].fa" :id="'popper-Lic' + (cc ? 'cc' : '') + file.i + file.index + file.lic" :title="lic.l" trigger="hover">    
                                <i :class="lic.fa"></i>
                            </pop-vue>
                        </div>
                    </div>
                </div>
                <div class="flex-row" role="cell">{{fancyBytes(file.s)}}</div>
                <div class="flex-row" role="cell">{{blockToTime(file.c)}}</div>
                <div class="flex-row" role="cell">{{blockToTime(file.e)}}<i v-if="newMeta[file.i].contract.autoRenew" class="fa-solid fa-arrows-rotate text-success fa-fw"></i></div>
                <div class="flex-row" role="cell">
                    <div class="mt-1">
                        <!-- link -->
                        <div v-if="!newMeta[file.i][file.f].encrypted">
                            <a :href="'https://ipfs.dlux.io/ipfs/' + file.f" target="_blank" class="w-100 btn btn-sm btn-info mb-1 mx-auto"><span class="d-flex align-items-center">URL<i class="ms-auto fa-solid fa-fw fa-up-right-from-square"></i></span></a>
                        </div>
                        <!-- decrypt  -->
                        <div v-if="newMeta[file.i][file.f].encrypted && !contract[file.i].encryption.key">
                            <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="decode(file.i)"><span class="d-flex align-items-center w-100">Decrypt<i class="fa-solid fa-fw ms-auto fa-lock-open"></i></span></button>
                        </div>
                        <!-- download enc -->
                        <div v-if="newMeta[file.i][file.f].encrypted && contract[file.i].encryption.key">
                            <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="downloadFile(file.f, file.i)"><span class="d-flex align-items-center w-100">Download<i class="fa-solid fa-download fa-fw ms-auto"></i></span></button>
                        </div>
                        <!-- add to post -->
                        <div v-if="assets">
                            <button type="button" class="w-100 btn btn-sm btn-purp mb-1 mx-auto" @click="addToPost(file.f, contract.i, index)"><span class="d-flex align-items-center w-100">Add to Post<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                        </div>
                        <!-- add to asset -->
                        <div v-if="assets">
                            <button type="button" class="w-100 btn btn-sm btn-purp mb-1 mx-auto" @click="addAsset(file, contract)"><span class="d-flex align-items-center w-100">Add asset<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>


        <div class="d-none table-responsive" v-if="viewOpts.list">
            <!-- item table -->
            <table class="table table-dark table-striped table-hover  align-middle mb-0">
                <thead>
                    <tr>
                        <!-- thumb -->
                        <th scope="col" class="col-1">
                            
                        </th>
                        <!-- name -->
                        <th scope="col" class="col-2">
                            <div class="d-flex flex-wrap align-items-center">
                                <div class="d-flex flex-wrap align-items-center">
                                    <i class="fa-solid fa-file fa-fw"></i>
                                    <span class="m-1">Filename</span>
                                </div>
                                <div class="d-none d-flex align-items-center">
                                    <button class="btn btn-sm btn-secondary ms-1"
                                        @click="sortContracts('c','asc')"><i
                                            class="fa-solid fa-caret-up"></i></button>
                                    <button class="btn btn-sm btn-secondary ms-1"
                                        @click="sortContracts('c','dec')"><i
                                            class="fa-solid fa-caret-down"></i></button>
                                </div>
                            </div>
                        </th>
                        <!-- owners -->
                        <th scope="col" class="col-2" v-if="owners.length > 1">
                            <div class="d-flex flex-wrap align-items-center">
                                <div class="d-flex flex-wrap align-items-center">
                                    <i class="fa-solid fa-tag fa-fw"></i>
                                    <span class="m-1">File Owner</span>
                                </div>
                                <div class="d-none d-flex align-items-center">
                                    <button class="btn btn-sm btn-secondary"
                                        @click="sortContracts('e','dec')"><i
                                            class="fa-solid fa-caret-up"></i></button>
                                    <button class="btn btn-sm btn-secondary ms-1"
                                        @click="sortContracts('e','asc')"><i
                                            class="fa-solid fa-caret-down"></i></button>
                                </div>
                            </div>
                        </th>
                        <!-- tags & labels -->
                        <th scope="col" class="col-2">
                            <div class="d-flex flex-wrap align-items-center">
                                <div class="d-flex flex-wrap align-items-center">
                                    <i class="fa-solid fa-tag fa-fw"></i>
                                    <span class="m-1">Tags & Labels</span>
                                </div>
                                <div class="d-none d-flex align-items-center">
                                    <button class="btn btn-sm btn-secondary"
                                        @click="sortContracts('e','dec')"><i
                                            class="fa-solid fa-caret-up"></i></button>
                                    <button class="btn btn-sm btn-secondary ms-1"
                                        @click="sortContracts('e','asc')"><i
                                            class="fa-solid fa-caret-down"></i></button>
                                </div>
                            </div>
                        </th>
                        <!-- size -->
                        <th scope="col" class="col-1">
                            <div class="d-flex flex-wrap align-items-center">
                                <div class="d-flex flex-wrap align-items-center">
                                    <i class="fa-solid fa-database fa-fw"></i>
                                    <span class="m-1">Size</span>
                                </div>
                                <div class="d-none d-flex align-items-center">
                                    <button class="btn btn-sm btn-secondary"
                                        @click="sortContracts('e','dec')"><i
                                            class="fa-solid fa-caret-up"></i></button>
                                    <button class="btn btn-sm btn-secondary ms-1"
                                        @click="sortContracts('e','asc')"><i
                                            class="fa-solid fa-caret-down"></i></button>
                                </div>
                            </div>
                        </th>
                        <!-- created -->
                        <th scope="col" class="col-1">
                            <div class="d-flex flex-wrap align-items-center">
                                <div class="d-flex flex-wrap align-items-center">
                                    <i class="fa-solid fa-calendar-days fa-fw"></i>
                                    <span class="m-1">Created</span>
                                </div>
                                <div class="d-none d-flex align-items-center">
                                    <button class="btn btn-sm btn-secondary"
                                        @click="sortContracts('e','dec')"><i
                                            class="fa-solid fa-caret-up"></i></button>
                                    <button class="btn btn-sm btn-secondary ms-1"
                                        @click="sortContracts('e','asc')"><i
                                            class="fa-solid fa-caret-down"></i></button>
                                </div>
                            </div>
                        </th>
                        <!-- expires -->
                        <th scope="col" class="col-1">
                            <div class="d-flex flex-wrap align-items-center">
                                <div class="d-flex flex-wrap align-items-center">
                                    <i class="fa-solid fa-clock fa-fw"></i>
                                    <span class="m-1">Expires</span>
                                </div>
                                <div class="d-none d-flex align-items-center">
                                    <button class="btn btn-sm btn-secondary"
                                        @click="sortContracts('e','dec')"><i
                                            class="fa-solid fa-caret-up"></i></button>
                                    <button class="btn btn-sm btn-secondary ms-1"
                                        @click="sortContracts('e','asc')"><i
                                            class="fa-solid fa-caret-down"></i></button>
                                </div>
                            </div>
                        </th>
                        <!-- buttons -->
                        <th scope="col" class="col-1">
                            
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="file in filesArray">
                        <th scope="row" class="col-1">
                            <div class="bg-light" style="width:50px;">
                                <img v-if="newMeta[file.i][file.f].thumb" class="mx-auto img-fluid rounded bg-light" :src="newMeta[file.i][file.f].thumb_data" width="50px" >
                                <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                        viewBox="0 0 800 800" style="enable-background:new 0 0 800 800;" xml:space="preserve">
                                    <g>
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
                                        <text transform="matrix(1 0 0 1 233.3494 471.9725)" class="st1 st2" style="text-transform: uppercase; font-size: 149px;">{{newMeta[file.i][file.f].type}}</text>
                                    </g>
                                </svg>
                            </div>
                        </th>
                        <td class="col-2">
                            <div class="text-break">{{newMeta[file.i][file.f].name || file.f}}{{newMeta[file.i][file.f].thumb ? '.' + newMeta[file.i][file.f].type : ''}}</div>
                        </td>
                         <td class="col-2" v-if="owners.length > 1">
                            <div class="text-break">@{{contract[file.i].t}}</div>
                        </td>
                        <td class="col-2">
                            <div class="d-flex flex-wrap align-items-center">
                                

                                    <div v-if="file.lc" class="d-flex me-1 align-items-center" style="margin-left: 15px">
                                            <i v-for="(color, num) in labelsDecode(file.lc)" :class="color.fa" :style="'margin-left: ' + -15 +'px !important;'"></i>
                                    </div>


                                <div class="me-1" v-for="label in labelsDecode(file.ll)">
                                    <span class="d-flex align-items-center">
                                        <pop-vue :id="'popperL-' + file.i + file.index + label.l + (cc ? 'cc' : '')" :title="label.l" trigger="hover">
                                            <i :class="label.fa"></i>
                                        </pop-vue>
                                    </span>
                                </div>

                                <div class="d-flex align-items-center">
                                <div v-for="flag in flagsDecode(newMeta[file.i][file.f].flags, 0, 3)" >
                                        <!-- title="Labels"  -->
                                        <pop-vue :id="'popper-' + file.i + file.index + flag.l + (cc ? 'cc' : '')" :title="flag.l" trigger="hover">
                                            <i :class="flag.fa"></i>
                                        </pop-vue>
                                    </div>
                                </div>
                                <pop-vue v-if="licenses[file.lic]" v-for="lic in licenses[file.lic].fa" :id="'popper-Lic' + (cc ? 'cc' : '') + file.i + file.index + file.lic" :title="lic.l" trigger="hover">    
                                    <i :class="lic.fa"></i>
                                </pop-vue> 
                            </div>
                        </td>
                        <td class="col-1">{{fancyBytes(file.s)}}</td>
                        <td class="col-1">{{blockToTime(file.c)}}</td>
                        <td class="col-1">{{blockToTime(file.e)}}<i v-if="newMeta[file.i].contract.autoRenew" class="fa-solid fa-arrows-rotate text-success fa-fw fa-spin"></i></td>
                        <td class="col-1">
                            <div class="mt-1">
                                <!-- link -->
                                <div v-if="!newMeta[file.i][file.f].encrypted">
                                    <a :href="'https://ipfs.dlux.io/ipfs/' + file.f" target="_blank" class="w-100 btn btn-sm btn-info mb-1 mx-auto"><span class="d-flex align-items-center">URL<i class="ms-auto fa-solid fa-fw fa-up-right-from-square"></i></span></a>
                                </div>
                                <!-- decrypt  -->
                                <div v-if="newMeta[file.i][file.f].encrypted && !contract[file.i].encryption.key">
                                    <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="decode(file.i)"><span class="d-flex align-items-center w-100">Decrypt<i class="fa-solid fa-fw ms-auto fa-lock-open"></i></span></button>
                                </div>
                                <!-- download enc -->
                                <div v-if="newMeta[file.i][file.f].encrypted && contract[file.i].encryption.key">
                                    <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="downloadFile(file.f, file.i)"><span class="d-flex align-items-center w-100">Download<i class="fa-solid fa-download fa-fw ms-auto"></i></span></button>
                                </div>
                                <!-- add to post -->
                                <div v-if="assets">
                                    <button type="button" class="w-100 btn btn-sm btn-purp mb-1 mx-auto" @click="addToPost(file.f, contract.i, index)"><span class="d-flex align-items-center w-100">Add to Post<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                                </div>
                                <!-- add to asset -->
                                <div v-if="assets">
                                    <button type="button" class="w-100 btn btn-sm btn-purp mb-1 mx-auto" @click="addAsset(file, contract)"><span class="d-flex align-items-center w-100">Add asset<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!-- item grid -->
        <div class="d-flex flex-wrap" v-if="!viewOpts.list">
            <div class="file-grid" v-for="file in filesArray">
                <div class="card bg-blur-darkg m-05 p-05 text-start">
                    <a :href="'https://ipfs.dlux.io/ipfs/' + file.f" target="_blank" class="no-decoration"><div class="text-black text-truncate">{{newMeta[file.i][file.f].name || file.f}}</div></a>
                    <h5 class="m-0 ms-auto align-self-end"><span class="d-none badge square rounded-top border border-bottom-0 bg-info border-light-50" :class="smartColor(file.lc)"><i :class="smartIcon(file.l)"></i>{{ newMeta[file.i][file.f].type }}</span></h5>
                    <div class="bg-light">
                        <img v-if="newMeta[file.i][file.f].thumb" class="mx-auto img-fluid rounded bg-light" :src="newMeta[file.i][file.f].thumb_data" width="128px" >    
                        <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                viewBox="0 0 800 800" style="enable-background:new 0 0 800 800;" xml:space="preserve">
                            <g>
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
                                <text transform="matrix(1 0 0 1 233.3494 471.9725)" class="st1 st2" style="text-transform: uppercase; font-size: 149px;">{{newMeta[file.i][file.f].type}}</text>
                            </g>
                        </svg>
                    </div>

                    

                    <div class="mt-1">
                            <!-- link -->
                            <div v-if="!newMeta[file.i][file.f].encrypted">
                                <a :href="'https://ipfs.dlux.io/ipfs/' + file.f" target="_blank" class="w-100 btn btn-sm btn-info mb-1 mx-auto"><span class="d-flex align-items-center">URL<i class="ms-auto fa-solid fa-fw fa-up-right-from-square"></i></span></a>
                            </div>
                            <!-- decrypt  -->
                            <div v-if="newMeta[file.i][file.f].encrypted && !contract[file.i].encryption.key">
                                <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="decode(file.i)"><span class="d-flex align-items-center w-100">Decrypt<i class="fa-solid fa-fw ms-auto fa-lock-open"></i></span></button>
                            </div>
                            <!-- download enc -->
                            <div v-if="newMeta[file.i][file.f].encrypted && contract[file.i].encryption.key">
                                <button type="button" class="w-100 btn btn-sm btn-primary mb-1 mx-auto" @click="downloadFile(file.f, file.i)"><span class="d-flex align-items-center w-100">Download<i class="fa-solid fa-download fa-fw ms-auto"></i></span></button>
                            </div>
                            <!-- add to post -->
                            <div v-if="assets">
                                <button type="button" class="w-100 btn btn-sm btn-purp mb-1 mx-auto" @click="addToPost(file.f, contract.i, index)"><span class="d-flex align-items-center w-100">Add to Post<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                            </div>
                            <!-- add to asset -->
                            <div v-if="assets">
                                <button type="button" class="w-100 btn btn-sm btn-purp mb-1 mx-auto" @click="addAsset(file, contract)"><span class="d-flex align-items-center w-100">Add asset<i class="fa-solid fa-plus fa-fw ms-auto"></i></span></button>
                            </div>
                    </div>

                    

                    <div class="d-flex flex-column rounded p-1" style="background-color: rgba(0, 0, 0, 0.6);">
    <!-- Edit Button -->
                        <div v-if="!(file.l.length || file.lf)" class="ms-auto me-auto text-muted">
                            
                        </div>

                        <div class="d-flex align-items-center justify-content-between">

                            <div class="me-1">
                                <div class="d-flex align-items-center" style="margin-left: 15px">
                                        <i v-for="(color, num) in labelsDecode(file.lc)" :class="color.fa" :style="'margin-left: ' + -15 +'px !important;'"></i>
                                </div>
                            </div>

                            <div class="mx-auto" v-for="(label, index) in labelsDecode(file.ll, 0)">
                                <span class="d-flex align-items-center w-100">
                                    <pop-vue :id="'popperL-' + (cc ? 'cc' : '') + file.i + index + label.l" title="Labels" trigger="hover">
                                        <i :class="label.fa"></i>
                                    </pop-vue>
                                </span>
                            </div>

                            <div class="d-flex align-items-center ms-auto ms-1">
                            <div v-for="flag in flagsDecode(newMeta[file.i][file.f].flags)" >
                                    <!-- title="Labels"  -->
                                    <pop-vue :id="'popper-' + (cc ? 'cc' : '') + file.i + file.index + flag.l" :title="flag.l" trigger="hover">
                                        <i :class="flag.fa"></i>
                                    </pop-vue>
                                </div>
                            </div>
                        </div>

                    </div>
                    
                    <div class="d-flex align-items-center justify-content-center text-break small text-muted">
                                {{fancyBytes(file.s)}}<pop-vue v-if="licenses[file.lic]" v-for="lic in licenses[file.lic].fa" :id="'popper-Lic' + (cc ? 'cc' : '') + file.i + file.index + file.lic" :title="lic.l" trigger="hover">    
                            <i :class="lic.fa"></i>
                        </pop-vue>
                        </div>
                    
                </div>
            </div>
        </div>
    </div>
</div>
   `,
    props: {
        assets: {
            type: Boolean,
            default: false,
        },
        contracts: {
            type: Object,
            default: function () {
                return [{
                    n: {},
                    p: 3,
                    df: {},
                    nt: "0",
                    i: "a:1:1",
                    id: "a-1-1",
                    m: "",
                    u: 1,
                    t: "",
                    extend: 7,

                }];
            }
        },
        account: {
            type: String,
            default: "",
        },
        current: {
            type: Number,
            default: 85000000,
        },
        cc: {
            default: false,
        },
        nodeview: {
            type: Boolean,
            default: false,
        }
    },
    data() {
        return {
            files: {},
            owners: [],
            contractIDs: {},
            newUser: '',
            filesArray: [],
            filterFlags: 0,
            filterLabels: "",
            postBodyAdder: {},
            filesSelect: {
                sort: "time",
                dir: "dec",
                search: "",
                cc_only: false,
                addusers: {},
            },
            contract: {},
            viewOpts: {
                list: true,
            },
            newMeta: {},
            decoded: false,
            debounce: null,
            labels: {
                ["0"]: { fa: "fa-solid fa-sink fa-fw", l: "Miscellaneous", c: 0 },
                ["1"]: { fa: "fa-solid fa-exclamation fa-fw", l: "Important", c: 0 },
                ["2"]: { fa: "fa-solid fa-star fa-fw", l: "Favorite", c: 0 },
                ["3"]: { fa: "fa-solid fa-dice fa-fw", l: "Random", c: 0 },
                ["4"]: { fa: "fa-solid fa-circle fa-fw text-red", l: "Red", c: 1 },
                ["5"]: { fa: "fa-solid fa-circle fa-fw text-orange", l: "Orange", c: 1 },
                ["6"]: { fa: "fa-solid fa-circle fa-fw text-yellow", l: "Yellow", c: 1 },
                ["7"]: { fa: "fa-solid fa-circle fa-fw text-green", l: "Green", c: 1 },
                ["8"]: { fa: "fa-solid fa-circle fa-fw text-blue", l: "Blue", c: 1 },
                ["9"]: { fa: "fa-solid fa-circle fa-fw text-purple", l: "Purple", c: 1 },
                ["A"]: { fa: "fa-solid fa-circle fa-fw text-grey", l: "Grey", c: 1 },
                ["B"]: { fa: "fa-solid fa-briefcase fa-fw", l: "Work", c: 0 },
                ["C"]: { fa: "fa-solid fa-heart fa-fw", l: "Personal", c: 0 },
                ["D"]: { fa: "fa-solid fa-people-roof fa-fw", l: "Family", c: 0 },
                ["E"]: { fa: "fa-solid fa-people-group fa-fw", l: "Friends", c: 0 },
                ["F"]: { fa: "fa-solid fa-rocket fa-fw", l: "Projects", c: 0 },
                ["G"]: { fa: "fa-solid fa-piggy-bank fa-fw", l: "Finance", c: 0 },
                ["H"]: { fa: "fa-solid fa-kit-medical fa-fw", l: "Health", c: 0 },
                ["I"]: { fa: "fa-solid fa-graduation-cap fa-fw", l: "Education", c: 0 },
                ["J"]: { fa: "fa-solid fa-compass fa-fw", l: "Travel", c: 0 },
                ["K"]: { fa: "fa-regular fa-calendar-days fa-fw", l: "Events", c: 0 },
                ["L"]: { fa: "fa-solid fa-camera fa-fw", l: "Photography", c: 0 },
                ["M"]: { fa: "fa-solid fa-gamepad fa-fw", l: "Gaming", c: 0 },
                ["N"]: { fa: "fa-solid fa-volleyball fa-fw", l: "Sports", c: 0 },
                ["O"]: { fa: "fa-solid fa-feather fa-fw", l: "Blogging", c: 0 },
                ["P"]: { fa: "fa-solid fa-crown fa-fw", l: "Meme", c: 0 },
                ["Q"]: { fa: "fa-solid fa-music fa-fw", l: "Music", c: 0 },
                ["R"]: { fa: "fa-solid fa-video fa-fw", l: "Video", c: 0 },
                ["S"]: { fa: "fa-solid fa-microphone fa-fw", l: "Audio", c: 0 },
                ["T"]: { fa: "fa-solid fa-newspaper fa-fw", l: "News", c: 0 },
                ["U"]: { fa: "fa-solid fa-code fa-fw", l: "Development", c: 0 },
                ["V"]: { fa: "fa-solid fa-hat-cowboy fa-fw", l: "Fashion", c: 0 },
                ["W"]: { fa: "fa-solid fa-burger fa-fw", l: "Food", c: 0 },
                ["X"]: { fa: "fa-solid fa-utensils fa-fw", l: "Cooking", c: 0 },
                ["Y"]: { fa: "fa-solid fa-toolbox fa-fw", l: "DIY", c: 0 },
                ["Z"]: { fa: "fa-solid fa-paintbrush fa-fw", l: "Art", c: 0 },
                ["a"]: { fa: "fa-solid fa-swatchbook fa-fw", l: "Design", c: 0 },
                ["b"]: { fa: "fa-solid fa-microchip fa-fw", l: "Technology", c: 0 },
                ["c"]: { fa: "fa-solid fa-cross fa-fw", l: "Religion", c: 0 },
                ["d"]: { fa: "fa-solid fa-scale-balanced fa-fw", l: "Government", c: 0 },
                ["e"]: { fa: "fa-solid fa-landmark-dome fa-fw", l: "Politics", c: 0 },
                ["f"]: { fa: "fa-solid fa-vial fa-fw", l: "Science", c: 0 },
                ["g"]: { fa: "fa-solid fa-magnifying-glass fa-fw", l: "Research", c: 0 },
                ["h"]: { fa: "fa-solid fa-receipt fa-fw", l: "Receipts", c: 0 },
                ["i"]: { fa: "fa-solid fa-envelope-open-text fa-fw", l: "Correspondence", c: 0 },
                ["j"]: { fa: "fa-solid fa-copy fa-fw", l: "Templates", c: 0 },
                ["k"]: { fa: "fa-solid fa-file-lines fa-fw", l: "Resources", c: 0 },
                ["l"]: { fa: "fa-solid fa-book-bookmark fa-fw", l: "Reference", c: 0 },
                ["m"]: { fa: "fa-solid fa-floppy-disk fa-fw", l: "Backups", c: 0 },
                ["n"]: { fa: "fa-solid fa-box-archive fa-fw", l: "Archive", c: 0 },
                ["o"]: { fa: "fa-solid fa-compass-drafting fa-fw", l: "Drafts", c: 0 },
                ["p"]: { fa: "fa-solid fa-flag-checkered fa-fw", l: "Finished", c: 0 },
                ["q"]: { fa: "fa-solid fa-paper-plane fa-fw", l: "Sent", c: 0 },
                ["r"]: { fa: "fa-solid fa-clock fa-fw", l: "Pending", c: 0 },
                ["s"]: { fa: "fa-solid fa-thumbs-up fa-fw", l: "Approved", c: 0 },
                ["t"]: { fa: "fa-solid fa-thumbs-down fa-fw", l: "Rejected", c: 0 },
                ["u"]: { fa: "fa-solid fa-lightbulb fa-fw", l: "Ideas", c: 0 },
                ["v"]: { fa: "fa-solid fa-bullseye fa-fw", l: "Goals", c: 0 },
                ["w"]: { fa: "fa-solid fa-list-check fa-fw", l: "Tasks", c: 0 },
                ["x"]: { fa: "fa-solid fa-gavel fa-fw", l: "Legal", c: 0 },
                ["y"]: { fa: "fa-solid fa-handshake fa-fw", l: "Networking", c: 0 },
                ["z"]: { fa: "fa-solid fa-comments fa-fw", l: "Feedback", c: 0 },
                ["+"]: { fa: "fa-solid fa-square-poll-vertical fa-fw", l: "Surveys", c: 0 },
                ["="]: { fa: "fa-solid fa-user-secret fa-fw", l: "Classified", c: 0 }
            },
            licenses: {
                ["1"]: {
                    fa: [{ fa: "fa-brands fa-creative-commons", l: "Creative Commons License" }, { fa: "fa-brands fa-creative-commons-by", l: "Attribution Required" }],
                    name: "CC BY",
                },
                ["2"]: {
                    fa: [{ fa: "fa-brands fa-creative-commons", l: "Creative Commons License" }, { fa: "fa-brands fa-creative-commons-by", l: "Attribution Required" }, { fa: "fa-brands fa-creative-commons-sa", l: "Share Alike" }],
                    name: "CC BY-SA",
                },
                ["3"]: {
                    fa: [{ fa: "fa-brands fa-creative-commons", l: "Creative Commons License" }, { fa: "fa-brands fa-creative-commons-by", l: "Attribution Required" }, { fa: "fa-brands fa-creative-commons-nd", l: "No Derivatives" }],
                    name: "CC BY-ND",
                },
                ["4"]: {
                    fa: [{ fa: "fa-brands fa-creative-commons", l: "Creative Commons License" }, { fa: "fa-brands fa-creative-commons-by", l: "Attribution Required" }, { fa: "fa-brands fa-creative-commons-nc", l: "Non-Commerical" }, { fa: "fa-brands fa-creative-commons-nd", l: "No Derivatives" }],
                    name: "CC BY-NC-ND",
                },
                ["5"]: {
                    fa: [{ fa: "fa-brands fa-creative-commons", l: "Creative Commons License" }, { fa: "fa-brands fa-creative-commons0-by", l: "Attribution Required" }, { fa: "fa-brands fa-creative-commons-nc", l: "Non-Commerical" }],
                    name: "CC BY-NC",
                },
                ["6"]: {
                    fa: [{ fa: "fa-brands fa-creative-commons", l: "Creative Commons License" }, { fa: "fa-brands fa-creative-commons-by", l: "Attribution Required" }, { fa: "fa-brands fa-creative-commons-nc", l: "Non-Commerical" }, { fa: "fa-brands fa-creative-commons-sa", l: "Share Alike" }],
                    name: "CC BY-NC-SA",
                },
                ["7"]: {
                    fa: [{ fa: "fa-brands fa-creative-commons-zero", l: "CC0", c: 1 }],
                    name: "CC0",
                },
            }
        };
    },
    emits: ["addassets"],
    methods: {
        addAsset(id, contract) {
            this.$emit("addassets", { id, contract });
        },
        cycleView(user){
            const view = this.filesSelect.addusers[user]
            switch(view){
                case true:
                    this.filesSelect.addusers[user] = 'cc'
                    break
                case false:
                    this.filesSelect.addusers[user] = true
                    break
                case 'lock':
                    this.filesSelect.addusers[user] = false
                    break
                case 'cc':
                    this.filesSelect.addusers[user] = 'lock'
                    break
            }
            this.render()
        },
        purge(user){
            delete this.filesSelect.addusers[user]
            this.owners = this.owners.filter(o => o != user)
            this.render()
        },
        appendUserFiles() {
            const newUser = this.newUser
            this.newUser = ''
            this.filesSelect.addusers[newUser] = true
            if(newUser)fetch("https://spktest.dlux.io/@" + newUser)
                .then((response) => response.json())
                .then((data) => {
                    this.contractIDs[newUser] = {}
                    for (var node in data.file_contracts) {
                        data.file_contracts[node].encryption = {
                            input: "",
                            key: "",
                            accounts: {},
                        }
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
                            for (var i = 0; i < filesNames.length; i++) {
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
                            }
                        } else {
                            if (data.file_contracts[node].m.indexOf('"') >= 0) data.file_contracts[node].m = JSON.parse(data.file_contracts[node].m)
                            var encData = data.file_contracts[node].m.split(',')[0] || ''
                            var renew = this.Base64toNumber(encData[0] || '0') & 1 ? true : false
                            var encAccounts = []
                            var encrypted = false
                            if (encData) {
                                encData = encData.split('#')
                                renew = this.Base64toNumber(encData.shift()) & 1 ? true : false
                                if (encData.length) {
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
                            for (var i = 0; i < filesNames.length; i++) {
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
                                if (this.newMeta[data.file_contracts[node].i][filesNames[i]].thumb) this.getImgData(data.file_contracts[node].i, filesNames[i])
                                if (this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 1) this.newMeta[data.file_contracts[node].i][filesNames[i]].encrypted = true
                                else this.newMeta[data.file_contracts[node].i][filesNames[i]].encrypted = false
                                if (this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 2) this.newMeta[data.file_contracts[node].i][filesNames[i]].is_thumb = true
                                else this.newMeta[data.file_contracts[node].i][filesNames[i]].is_thumb = false
                                if (this.Base64toNumber(this.newMeta[data.file_contracts[node].i][filesNames[i]].flags) & 4) this.newMeta[data.file_contracts[node].i][filesNames[i]].nsfw = true
                                else this.newMeta[data.file_contracts[node].i][filesNames[i]].nsfw = false
                            }
                        }
                        this.contractIDs[newUser][data.file_contracts[node].i] = data.file_contracts[node];
                        this.contractIDs[newUser][data.file_contracts[node].i].index = this.contracts.length - 1;
                        this.postBodyAdder[data.file_contracts[node].i] = {}

                    }
                    for (var user in data.channels) {
                        for (var node in data.channels[user]) {
                            if (this.contractIDs[newUser][data.channels[user][node].i]) continue
                            else {
                                this.contractIDs[newUser][data.channels[user][node].i] = data.channels[user][node];
                                this.contractIDs[newUser][data.channels[user][node].i].index = this.contracts.length - 1;
                            }
                        }
                    }
                    this.init()

                });
        },
        AESDecrypt(encryptedMessage, key) {
            const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
            return bytes.toString(CryptoJS.enc.Utf8);
        },
        handleLabel(m) {
            if (m.action == 'added') {
                var string = this.filterLabels
                if (!string) string = '2'
                this.filterLabels += m.item
            } else {
                var string = this.filterLabels
                var arr = string.split('')
                for (var j = 0; j < arr.length; j++) {
                    if (arr[j] == m.item) arr.splice(j, 1)
                }
                this.filterLabels = arr.join('')
            }
            this.render()
        },
        handleTag(m) {
            var num = this.Base64toNumber(this.filterFlags) || 0
            if (m.action == 'added') {
                if (num & m.item) { }
                else num += m.item
                this.filterFlags = num
            } else {
                if (num & m.item) num -= m.item
                this.filterFlags = num
            }
            this.render()
        },
        download(fileInfo, data = false, MIME_TYPE = "image/png") {
            if (data) {
                var blob = new Blob([data], { type: MIME_TYPE });
                window.location.href = window.URL.createObjectURL(blob);
            } else {
                fetch(`https://ipfs.dlux.io/ipfs/${fileInfo}`)
                    .then((response) => response.blob())
                    .then((blob) => {
                        var url = window.URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = fileInfo;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                    });
            }
        },
        downloadFile(cid, id) {
            fetch(`https://ipfs.dlux.io/ipfs/${cid}`)
                .then((response) => response.text())
                .then((blob) => {

                    const name = this.newMeta[id][cid].name + '.' + this.newMeta[id][cid].type || 'file'
                    if (this.contract[id].encryption.key) {
                        blob = this.AESDecrypt(blob, this.contract[id].encryption.key);
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
        smartIcon(flags = "") {
            if (!flags[0]) return 'fa-solid fa-file'
            const flag = this.flagDecode(flags[0])
            if (flag.enc) return 'fa-solid fa-file-shield'
            else if (flag.nsfw) return 'fa-solid fa-triangle-exclamation'
            else if (flag.executable) return 'fa-solid fa-cog'
            else return 'fa-solid fa-file'
        },
        smartColor(flags = "") {
            if (!flags[0]) return 'bg-info'
            const flag = this.flagDecode(flags[0])
            if (flag.nsfw) return 'bg-danger'
            else if (flag.executable) return 'bg-warning'
            else if (flag.enc) return 'bg-dark'
            else return 'bg-info'
        },
        smartThumb(contract, cid) {
            if (this.newMeta[contract][cid].thumb.includes('https://')) {
                return this.newMeta[contract][cid].thumb
            } else if (this.newMeta[contract][cid].thumb.includes('Qm')) {
                return `https://ipfs.dlux.io/ipfs/${this.newMeta[contract][cid].thumb}`
            } else return false
        },
        blockToTime(block) {
            const now = new Date().getTime()
            const then = new Date(now - ((this.current - block) * 3000))
            // simple ago or until format

            return then.toLocaleDateString()
        },
        fancyBytes(bytes, decimals = 0) {
            var counter = 0, p = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
            while (bytes > 1024) {
                bytes = bytes / 1024
                counter++
            }
            return `${this.toFixed(bytes, decimals)} ${p[counter]}B`
        },
        toFixed(n, digits) {
            return parseFloat(n).toFixed(digits)
        },
        copyText(text) {
            navigator.clipboard.writeText(text)
        },
        flagDecode(flags = "") {
            var num = this.Base64toNumber(flags[0])
            var out = {
                enc: num & 1,
                autoRenew: num & 2,
                nsfw: num & 4,
                executable: num & 8
            }
            return out
        },
        flagsDecode(flags = "", only = 0, omit = 0) {
            var num = typeof flags == "string" ? this.Base64toNumber(flags[0]) : flags
            var out = []
            if (only) num = num & only
            if (omit) num = num & ~omit
            if (num & 1) out.push({ fa: 'fa-solid fa-lock text-primary fa-fw', l: "Encrypted" })
            if (num & 2) out.push({ fa: 'fa-solid fa-arrows-rotate text-success fa-fw fa-spin', l: "Thumbnail" })
            if (num & 4) out.push({ fa: 'fa-solid fa-radiation text-warning fa-fw', l: "NSFW" })
            if (num & 8) out.push({ fa: 'fa-regular fa-file-code text-info fa-fw', l: "Executable" })
            return out
        },
        labelsDecode(flags = "", only = -1) {
            var arr = []
            if (flags.length == 0) return arr
            const len = only >= 0 ? 1 : flags.length
            for (var i = (only >= 0 ? only : 0); i < len; i++) {
                arr.push(this.labels[flags[i]])
            }
            arr = new Set(arr)
            return new Array(...arr)
        },
        Base64toNumber(chars = "0") {
            if (typeof chars != 'string') {
                return 0
            }
            const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
            var result = 0;
            chars = chars.split("");
            for (var e = 0; e < chars.length; e++) {
                result = result * 64 + glyphs.indexOf(chars[e]);
            }
            return result;
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
        decode(id) {
            return new Promise((resolve, reject) => {
                const key = this.contract[id].encryption.accounts[this.account].enc_key;
                hive_keychain.requestVerifyKey(this.account, key, 'Memo', (response) => {
                    if (response.success) {
                        this.contract[id].encryption.key = response.result.split('#')[1]
                        resolve("OK")
                    } else {
                        reject(response.message);
                    }
                });
            })
        },
        render() {
            this.filesArray = []
            for (var i in this.files) {
                this.filesArray.push(this.files[i])
            }
            // filterFlags: "=",
            // filterLabels: "",
            // filesSelect: {
            //     sort: "time",
            //     dir: "dec",
            //     search: "",
            // },
            this.filesArray = this.filesArray.filter((file) => {
                if (this.filterFlags && !(this.filterFlags & file.lf)) return false
                if (this.filterLabels) {
                    const arr = this.filterLabels.split('')
                    for (var j = 0; j < arr.length; j++) {
                        if (file.l.indexOf(arr[j]) == -1) return false

                    }
                }
                switch (this.filesSelect.addusers[file.o]){
                    case false:
                        return false
                    case 'lock':
                        if (!(file.lf & 1) && !this.contract[file.i].encryption.accounts[this.account]) return false
                        break
                    case 'cc':
                        if (!file.lic) return false
                    case true:
                        break
                    default:
                        return false
                }
                if(this.filesSelect.cc_only && (!file.lic && file.o != this.account)) return false
                if (this.filesSelect.search && file.n.toLowerCase().indexOf(this.filesSelect.search.toLowerCase()) == -1) return false
                return true
            })
            this.filesArray.sort((a, b) => {
                if (this.filesSelect.sort == 'time') {
                    if (this.filesSelect.dir == 'dec') return a.c - b.c
                    else return b.c - a.c
                } else if (this.filesSelect.sort == 'size') {
                    if (this.filesSelect.dir == 'dec') return a.s - b.s
                    else return b.s - a.s
                } else if (this.filesSelect.sort == 'name') {
                    if (this.filesSelect.dir == 'dec') return a.n.localeCompare(b.n)
                    else return b.n.localeCompare(a.n)
                } else if (this.filesSelect.sort == 'type') {
                    if (this.filesSelect.dir == 'dec') return a.y - b.y
                    else return b.s - a.s
                } else if (this.filesSelect.sort == 'exp') {
                    if (this.filesSelect.dir == 'dec') return a.e - b.e
                    else return b.e - a.e
                } else {
                    return 0
                }
            })

        },
        getImgData(id, cid) {
            var string = this.smartThumb(id, cid)
            fetch(string).then(response => response.text()).then(data => {
                if (data.indexOf('data:image/') >= 0) this.newMeta[id][cid].thumb_data = data
                else this.newMeta[id][cid].thumb_data = string
            }).catch(e => {
                this.newMeta[id][cid].thumb_data = string
            })
        },
        init() {
            var contracts = []
            //for (var user in this.contracts) {
                for (var id in this.contracts) {
                    contracts.push(this.contracts[id])
                    if(this.nodeview)this.filesSelect.addusers[this.contracts[id].t] = true
                }
            //}
            for (var user in this.filesSelect.addusers) {
                for (var id in this.contractIDs[user]) {
                    contracts.push(this.contractIDs[user][id])
                }
            }
            for (var i in contracts) {
                if (contracts[i].c == 1) continue
                const id = contracts[i].i
                this.contract[id] = contracts[i];
                this.owners.push(contracts[i].t)
                if (!this.contract[id].m) {
                    this.contract[id].autoRenew = false
                    this.contract[id].m = ""
                    this.newMeta[id] = {
                        contract: {
                            autoRenew: false,
                            encrypted: false,
                            m: "",
                        }
                    }
                    var filesNames = this.contract[id]?.df ? Object.keys(this.contract[id].df) : []
                    filesNames = filesNames.sort((a, b) => {
                        if (a > b) return 1
                        else if (a < b) return -1
                        else return 0
                    })
                    for (var i = 0; i < filesNames.length; i++) {
                        this.newMeta[id][filesNames[i]] = {
                            name: '',
                            type: '',
                            thumb: '',
                            flags: '',
                            is_thumb: false,
                            encrypted: false,
                            license: '',
                            labels: '',
                        }

                        //links += `![File ${i + 1}](https://ipfs.dlux.io/ipfs/${filesNames[i]})\n`
                    }
                } else {
                    if (this.contract[id].m.indexOf('"') >= 0) this.contract[id].m = JSON.parse(this.contract[id].m)
                    var encData = this.contract[id].m.split(',')[0] || ''
                    var renew = this.Base64toNumber(encData[0] || '0') & 1 ? true : false
                    var encAccounts = []
                    var accounts = {}
                    var encrypted = false
                    if (encData) {
                        encData = encData.split('#')
                        renew = this.Base64toNumber(encData.shift()) & 1 ? true : false
                        if (encData.length) {
                            encData = '#' + encData.join('#')
                            encAccounts = encData.split(';')
                            encrypted = true
                        }
                    }
                    this.newMeta[id] = {
                        contract: {
                            autoRenew: renew,
                            encrypted,
                            encryption: {
                                key: '',
                            },
                            m: this.contract[id].m,
                        }
                    }
                    for (var i = 0; i < encAccounts.length; i++) {
                        const encA = encAccounts[i].split('@')[1]
                        this.contract[id].autoRenew = renew
                        this.contract[id].encryption.accounts[encA] = {
                            enc_key: `#${encAccounts[i].split('@')[0].split('#')[1]}`,
                            key: '',
                        }
                    }

                    var filesNames = this.contract[id]?.df ? Object.keys(this.contract[id].df) : []
                    filesNames = filesNames.sort((a, b) => {
                        if (a > b) return 1
                        else if (a < b) return -1
                        else return 0
                    })
                    const slots = this.contract[id].m.split(",")
                    for (var i = 0; i < filesNames.length; i++) {
                        const flags = slots[i * 4 + 4]
                        this.newMeta[id][filesNames[i]] = {
                            name: slots[i * 4 + 1],
                            type: slots[i * 4 + 2],
                            thumb: slots[i * 4 + 3],
                            thumb_data: slots[i * 4 + 3],
                            flags: this.Base64toNumber(flags.indexOf('-') >= 0 ? flags.split('-')[0] : flags[0]),
                            license: flags.indexOf('-') >= 0 ? flags.split('-')[1] : '',
                            labels: flags.indexOf('-') >= 0 ? flags.split('-')[2] : flags.slice(1),
                        }
                        if (this.newMeta[id][filesNames[i]].thumb) this.getImgData(id, filesNames[i])
                        if (this.newMeta[id][filesNames[i]].flags & 1) this.newMeta[id][filesNames[i]].encrypted = true
                        else this.newMeta[id][filesNames[i]].encrypted = false
                        if (this.newMeta[id][filesNames[i]].flags & 2) this.newMeta[id][filesNames[i]].is_thumb = true
                        else this.newMeta[id][filesNames[i]].is_thumb = false
                        if (this.newMeta[id][filesNames[i]].flags & 4) this.newMeta[id][filesNames[i]].nsfw = true
                        else this.newMeta[id][filesNames[i]].nsfw = false
                        var ll = "", lc = "", l = this.newMeta[id][filesNames[i]].labels
                        for (var k = 0; k < l.length; k++) {
                            if (this.labels[l[k]]) {
                                if (this.labels[l[k]].c) lc += l[k]
                                else ll += l[k]
                            }
                        }
                        if (!this.newMeta[id][filesNames[i]].is_thumb) {
                            const f = {
                                i: id,
                                f: filesNames[i],
                                c: id.split(':')[2].split('-')[0],
                                e: this.contract[id].e.split(':')[0],
                                n: this.newMeta[id][filesNames[i]].name || keys[j],
                                y: this.newMeta[id][filesNames[i]].type || keys[j],
                                o: this.contract[id].t,
                                index: i,
                                lf: this.newMeta[id][filesNames[i]].flags || 0,
                                l: this.newMeta[id][filesNames[i]].labels,
                                lc,
                                ll,
                                lic: this.newMeta[id][filesNames[i]].license,
                                t: this.newMeta[id][filesNames[i]].thumb || '',
                                s: this.contract[id].df[filesNames[i]],
                                p: false
                            }
                            this.files[f.f] = f
                        }
                    }
                }
                // var keys = Object.keys(this.contract[id].df)
                // for (var j in keys) {
                //     var ll = "", lc = "", l = this.newMeta[id][j * 4 + 4] ? this.newMeta[id][j * 4 + 4].slice(1) || '' : ''
                //     for (var k = 0; k < l.length; k++) {
                //         if (this.labels[l[k]]) {
                //             if (this.labels[l[k]].c) lc += l[k]
                //             else ll += l[k]
                //         }
                //     }
                //     const f = {
                //         i: id,
                //         f: keys[j],
                //         c: this.contract[id].i.split(':')[2].split('-')[0],
                //         e: this.contract[id].e.split(':')[0],
                //         n: this.newMeta[id][j * 4 + 1] || keys[j],
                //         y: this.newMeta[id][j * 4 + 2] || keys[j],
                //         index: j,
                //         lf: parseInt(this.Base64toNumber(this.newMeta[id][j * 4 + 4][0]) || 0),
                //         l,
                //         lc,
                //         ll,
                //         t: this.newMeta[id][j * 4 + 3] || '',
                //         s: this.contract[id].df[keys[j]],
                //         p: false
                //     }
                //     this.files[f.f] = f
                // }
            }
            this.owners = [...new Set(this.owners)]
            this.render()
            // remove duplicates from filesArray
            //this.filesArray = this.filesArray.filter((v, i, a) => a.findIndex(t => (t.f === v.f)) === i)
        }
    },
    computed: {
        hasFiles() {
            return Object.keys(this.files).length > 0;
        }
    },
    watch: {
        'contracts': {
            handler: function (newValue) {
                if (this.debounce && new Date().getTime() - this.debounce < 1000) {
                    setTimeout(() => {
                        this.init()
                    },1000)
                    return
                }
                this.init()
                this.debounce = new Date().getTime()
            },
            deep: true
        },
        'account': {
            handler: function (newValue) {
                if(this.account)this.filesSelect.addusers[this.account] = true
                this.init()
            },
            deep: false
        },
        
    },
    mounted() { 
        if(this.account)this.filesSelect.addusers[this.account] = true
        if(!this.nodeview)this.filesSelect.cc_only = false
    },
};