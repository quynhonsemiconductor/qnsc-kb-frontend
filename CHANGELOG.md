# Changelog

## [0.2.1](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/compare/v0.2.0...v0.2.1) (2026-11-05)


### 🐛 Bug Fixes

* **kb-fe:** own the PDF load task; destroy it at every cancellation point ([#175](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/175)) ([cf02723](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/cf0272384d2db83eda7760ea58bd586103456ef0))

## [0.2.0](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/compare/v0.1.1...v0.2.0) (2026-11-05)


### ⚠ BREAKING CHANGES

* requires the backend department-member endpoints from QNSC-VN/qnsc-kb-backend#125. Removes the /admin/access-groups route, the Access groups nav entry (both locales) and the listAccessGroups, listAccessGroupMembers, createAccessGroup and replaceAccessGroupMembers API helpers.

### ✨ Features

* **account:** explain how to use an MCP connection ([#130](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/130)) ([2d74c97](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/2d74c97c4121ebda21a5db42cb1a369aaeabe4fd))
* **account:** manage MCP access tokens ([#129](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/129)) ([63c95c4](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/63c95c4f8cfebe138bc8f6f98aecd77a56821e59))
* **account:** user menu in the header and an account page ([#124](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/124)) ([0aa90b6](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/0aa90b6cf4c8c30be165cc0c56c6b262082e8506))
* **ai:** show a refusal as a neutral card with the nearest documents ([#123](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/123)) ([26f6700](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/26f6700298162920768bf5a3884a0792403ccb03))
* **ai:** show assistant tables, the new agent steps and corpus coverage ([#126](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/126)) ([ad0bc48](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/ad0bc48b969bc2eeea332d29189fcdc01533e9d4))
* **ai:** show figures and tables in the answer, and make them interactive ([#125](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/125)) ([3b185ba](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/3b185ba7fdd3844691eef6f00615c0c0daa2ee05))
* **ai:** show the agent's steps, charts and marked figures; fix the misaligned progress badge ([#111](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/111)) ([39a397c](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/39a397c97d4585049c15e843eafef60eafafa417))
* article versioning UI, tag hierarchy, and a visual knowledge graph ([#72](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/72)) ([ff9af69](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/ff9af69865bcf2fb3b3e16b21e0df28fee09bfa3))
* **articles:** correct text by selecting it in the document ([#113](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/113)) ([2ac80ae](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/2ac80ae87f5a18eb179093efdff71a68b6c9d81d))
* **articles:** correct text inside the original file from the article page ([#109](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/109)) ([eb2e59f](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/eb2e59f3d5e079a4294f95c4ddf22b2dd9a7b378))
* **articles:** show the original file on the article page and which documents are not indexed yet ([#106](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/106)) ([cd4d864](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/cd4d86453a454c1f22af834f6c1010d7041a852a))
* **auth:** accept an invitation, and recover or change a password ([#41](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/41)) ([f61d44b](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/f61d44bde7af70aeeb4e45570e84195459c1d856))
* **connectors:** map any ACL principal; stop offering a looping retry ([#55](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/55)) ([1e54941](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/1e54941210e62f900be782fb20f759455a92b55a))
* **connectors:** show OneDrive, hide unconfigured providers ([#56](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/56)) ([4c64d00](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/4c64d00b69c5f27bfd141717661b0845bac6a796))
* **connectors:** show which provider principals resolved themselves ([#114](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/114)) ([e70fb4b](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/e70fb4bde15c8e119efe344bf2e40224f05c455f))
* **departments:** choose which departments publish without review ([#135](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/135)) ([355511e](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/355511e3706eda4b06bcee86da0b6476a4799e15))
* **drafts:** preview Word and Excel files in the review pane ([#97](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/97)) ([d9be795](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/d9be795737125642e2463ab6fa4e33d91c1f8137))
* **drafts:** show the real number of pending drafts, load more, and search the whole queue ([#96](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/96)) ([088d267](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/088d267310470c199b1f8b11dd80f48ed340b877))
* governance risk-tier/version UI, unverified-claim warnings, and a redesigned knowledge graph ([#73](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/73)) ([787d562](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/787d56220eb7df954e18a3e9cab1d9298dce5ec8))
* **governance:** add an admin UI for AI approval rules ([#60](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/60)) ([cadd64c](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/cadd64cfe6da34a6b2dca6d7cca8176af00edb86))
* **governance:** investigate view on the health dashboard ([#144](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/144)) ([950708d](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/950708d20966b9968c23f54465787e316eeeb652))
* **governance:** reject undecided drafts in bulk and show the rejection reason ([#132](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/132)) ([ba73415](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/ba7341584cb4821515f4276d5619fe88b3cba90f))
* **governance:** review the draft queue in bulk ([#42](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/42)) ([6f2becd](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/6f2becd1cc4271f68cd57d2d612db230bff2e4b9))
* **lib:** reload once on vite:preloadError ([#100](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/100)) ([2e082b7](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/2e082b7a44b0a30d1b1fcf0474c151971ca86285))
* redesign the knowledge workspace ([#78](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/78)) ([b71edaf](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/b71edafdda8ccaa3f2cd53736564eb25f53075d6))
* resolve conflicts by choosing the right article, answer feedback queue, team AI config editor ([#138](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/138)) ([aa26523](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/aa2652313206882244635b719d5ba238d2cf3124))
* restore the workspace scale and ship the connector health view ([#27](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/27)) ([b3659d5](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/b3659d578eccc4d78d125ed99b29c352b6a1a960))
* review the original file, not just its text ([#90](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/90)) ([71a86b2](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/71a86b21512d3859d3623898e645cbfa94afa5b8))
* show cited figures and tables in the answer ([#91](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/91)) ([2b899b6](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/2b899b672d8134addba1674e805a1ec2b9f2ab86))
* show each cited figure beside the claim citing it ([#92](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/92)) ([f2cee98](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/f2cee98b0cf478b83b1c9140f8fff53480b40f1e))
* simplify pending draft management ([#82](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/82)) ([01dad18](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/01dad18a1bd22000d0477fbbee3e408eef66ab0a))
* simplify source and AI provider setup ([#86](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/86)) ([11c95b2](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/11c95b26f2b9c2c429a644fd39779017a955ef3e))
* surface multimodal evidence analytics ([#83](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/83)) ([87ecb83](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/87ecb83a8a81391da1390770a7102de099992ed0))
* **ui:** micro-interactions, performance, and accessibility ([#30](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/30)) ([6010f07](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/6010f07e9bad73d6b32c1a72a03bf6bfe508c8df))
* **ui:** migrate all pages to shared component library ([#31](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/31)) ([3780307](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/37803077be1677a2ce46651b798a0cc6dabdcc46))
* **ui:** refresh status banners in place instead of on manual reload ([#35](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/35)) ([8bf49b3](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/8bf49b362752e9eac1ebcfcbf749a3cce165cc73))
* **ui:** show documents held after repeated errors, and allow a retry ([#36](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/36)) ([1f35a9d](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/1f35a9d45fda0cdfa4b546f77f187b7c5305d00f))
* **ui:** show the web app and server build in the account menu ([#128](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/128)) ([f0e62cd](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/f0e62cd5bddb9e735db4afdfefe5e2528d705b72))
* **ui:** show where each source's documents got to ([#38](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/38)) ([34d9aa8](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/34d9aa8f5d01126d96196c64d27da91e8fca587f))
* **web:** choose whether answers and search include team lessons ([#153](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/153)) ([d162bbb](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/d162bbbfd4bb83f65d9fe1be106b60008393ef1b))
* **web:** mark team lessons in Browse and on their page, and not as verified on Home ([#157](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/157)) ([1e7baae](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/1e7baae55ea9a56c66681422423cea489b34e91e))
* **web:** mark the searched words in results and show excerpts as plain text ([#156](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/156)) ([a800407](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/a8004074a5b60c7f3865d591b710829c553a0071))
* **web:** runtime config and a web image for the cluster ([#146](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/146)) ([7ec62bc](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/7ec62bc46b6cf5b2eba78f9736ce8ce924bfa41b))
* **web:** the article editor speaks the chosen language ([#163](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/163)) ([c5e248b](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/c5e248b05bbee99d5d256efd5fd1122a7079a559))
* **web:** the article page speaks the chosen language ([#165](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/165)) ([cabc7a3](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/cabc7a338e0feffd07543f876f7cc1bf422bea7e))
* **web:** the library page speaks the chosen language and does not list the lesson tag as a topic ([#164](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/164)) ([fda2d78](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/fda2d78511d33cf1db4e06cad3f68f1598accd84))
* **web:** the strip above the question box speaks the chosen language ([#166](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/166)) ([3c4e205](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/3c4e205470ad0af6b0365bb5b9758afc24232c7c))


### 🐛 Bug Fixes

* **articles:** send a published edit to the article, not the review queue ([#43](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/43)) ([b3428ed](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/b3428ed851ffa6a329f1f9a95cbe1b8ecac61287))
* **articles:** show PDFs in a frame, not an embed element, so the original is not blank ([#112](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/112)) ([56f0ff3](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/56f0ff38b19564195918677da5017c2dfb427dde))
* **ci:** run CI on stacked pull requests, not only PRs aimed at main ([#70](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/70)) ([d0cca6c](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/d0cca6ce931d80d7ac03c68e3674ca1f12916fd4))
* **ci:** sweep callers to ci v1.24.3; drop the removed CLOUDFLARE_ACCOUNT_ID input ([#127](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/127)) ([7822f1d](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/7822f1d9aa2f07509c6eed78172fb3176e5fb7cf))
* **ci:** tolerate transient deploy gate API errors ([#85](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/85)) ([7ed10b4](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/7ed10b4d3a48b89b24ddc1f70a0108803c325881))
* **deps:** bump transitive deps to clear osv findings ([#116](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/116)) ([9743ffd](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/9743ffd46056a67271187d9ce08f470e78ef5262))
* **deps:** bump vitest to 4.1.12 for two @vitest/mocker advisories ([#108](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/108)) ([b29ee67](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/b29ee67c3daec3957078be36e35abfc3f2f4f09b))
* **deps:** update npm production (non-major) ([#142](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/142)) ([627c344](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/627c344e338d30da312682c11eb3972421a5105b))
* **dev:** pin the dev port and read the proxy target from .env ([#98](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/98)) ([bf9aba1](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/bf9aba121233894fc81d0dc5a281c7f4e16530c2))
* **drafts:** show AI formatting deferred by a rate limit, and keep polling it ([#93](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/93)) ([157cc41](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/157cc414275bfefddb815037a5750cef7724833b))
* **governance:** decide any number of selected drafts by batching ([#131](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/131)) ([34e3279](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/34e3279eea1b7cfea324e6030049bcbbea46fc29))
* **governance:** treat a skipped AI format as terminal, not retryable ([#77](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/77)) ([59acaf3](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/59acaf37e423e2277cb232f1ebb1c8391d14264b))
* harden frontend interaction reliability ([#81](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/81)) ([79c7d43](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/79c7d43cb810441baf2eb551c55036f774f5a1a8))
* keep prepared drafts visible ([#89](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/89)) ([266c16a](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/266c16a09224bd5daedd283366cae93ee37fdd1b))
* prevent duplicate AI retry turns ([#84](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/84)) ([528cdf3](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/528cdf3326789eb979d5ef0ee2afabc34b538f57))
* prevent navigation and overlay collisions ([#80](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/80)) ([07dfce7](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/07dfce737735ee85873cb494337f58309afbf0a7))
* refresh home after publishing drafts ([#88](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/88)) ([e86cc1b](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/e86cc1b8009f2c85323feae02ed6e437930e9203))
* replace crowded navbar with dropdown groups ([#79](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/79)) ([ea12ac2](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/ea12ac215dbaaa285b3cc8122b044a9166b29cea))
* show real department spaces on home ([#87](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/87)) ([f4610ff](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/f4610ff9041fe7f6bea5287cc7bebcaa271d26c1))
* **ui:** give the tooltip readable text instead of a solid block ([#33](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/33)) ([fe6c6d1](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/fe6c6d19ef43a1a1b8f15ade61cf5aecd3c55ef9))
* **ui:** read API timestamps as UTC so times show in the browser's zone ([#37](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/37)) ([89171e8](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/89171e86291070c4c7d9092c04203367c02e573c))
* **ui:** remove the hover tooltip entirely ([#34](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/34)) ([2204d0a](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/2204d0a09e63b26d970499692b3e3091574033a6))
* **ui:** say which permission principals are blocking an approval ([#39](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/39)) ([320f122](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/320f1226ee55920f6b8dc60078fb830f71a57990))
* **ui:** show what the provider calls each ACL principal ([#40](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/40)) ([d5bfd7d](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/d5bfd7da7822888db6477b584c3c34bb88481d83))
* **ui:** stop citation chips and buttons flashing white on hover ([#32](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/32)) ([5670c29](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/5670c29c264f1d1e40acf99a72e0a2e7edbabc45))
* **web:** a search opened from a link runs under StrictMode too ([#162](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/162)) ([73c4ac3](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/73c4ac369aa878f14f123404838dd47d2044bb53))
* **web:** answer /livez as well as /healthz ([#150](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/150)) ([f9b9cfc](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/f9b9cfc70b75a216d8dc3f640a8f7805c1030170))
* **web:** dates are written in the language the app is shown in ([#168](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/168)) ([31c524b](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/31c524b54757ac643a9944a67bdf964187d54eac))
* **web:** make the workspace readable, navigable, and honest about what it knows ([#53](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/53)) ([2f4f75b](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/2f4f75b3f1cae23d39395f8c5a3afc8d688f5e40))
* **web:** stop losing editor work, ship a CSP, and verify permissions ([#44](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/44)) ([b655048](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/b6550485440ed8c1f5f2750063e022ae1fd200a3))
* **web:** strip Caddy's file capabilities so pods can exec it ([#152](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/152)) ([cf46c64](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/cf46c64ed75403726798e779d031d3b81c8b674f))
* **web:** the document list of Browse gets room on a phone ([#170](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/170)) ([badedf5](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/badedf500d7718a94abaa7ddd0c81947d37e2d4c))


### ⚡ Performance

* ask for the article list without the document bodies ([#145](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/145)) ([b4e8778](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/b4e87787241f4194dbd2d313fe9a5ffd2b5b16a3))
* **ui:** remove per-frame compositing work and ship the real QNSC mark ([#29](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/29)) ([390ccd6](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/390ccd6c123e45d4338950f075f09e52b611cb08))


### ♻️ Refactors

* **ci:** call the shared pr-title action ([#63](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/63)) ([4f4b843](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/4f4b843716444709193e5d15e9833b5c015c07a5))
* manage audiences as departments, drop access groups ([#54](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/54)) ([034eae4](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/034eae4b60615e6ec55f1fabdaea8bc6d6b3ed36))


### 📦 Dependencies

* bump the production-dependencies group across 1 directory with 5 updates ([#18](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/18)) ([35fc184](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/35fc18479b7fe62047e3324f1b15f27b67e593e3))
* bump vitest from 2.1.9 to 3.2.6 ([#12](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/issues/12)) ([1d51973](https://github.com/quynhonsemiconductor/qnsc-kb-frontend/commit/1d51973a27ab9ab30cbb4dea6c0349f2bfac25cc))

## [0.1.1](https://github.com/QNSC-VN/qnsc-kb-frontend/compare/v0.1.0...v0.1.1) (2026-08-25)


### ✨ Features

* **ci:** add zizmor Actions-security scan job ([#24](https://github.com/QNSC-VN/qnsc-kb-frontend/issues/24)) ([d52739d](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/d52739d15b7b96d7702330b5e18d28f7a009ea3c))
* init project ([e100825](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/e100825546525ae3e9cc05f443ca38e52c0b8dc6))
* phase 1 ([e48e18d](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/e48e18d2c6907435791100b3efa9147f8bf9e157))
* phase2 ([d2a7854](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/d2a78540ab8495bd4df07aa892c4541a9e5e9cff))
* phase2 ([6009d5b](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/6009d5b6317bf1ad168c9c539a5238c076f411aa))
* update new UI ([a85d4ff](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/a85d4fffd7de5bb5fc4912a904308ef79a3d4bce))
* update new UI ([#15](https://github.com/QNSC-VN/qnsc-kb-frontend/issues/15)) ([1170dbe](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/1170dbe2e74b6cd528fc410a23ed86c6d43271b5))
* update phase 1 ([6685191](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/66851918b85482343955ac4f0209fd1e00df5045))


### 🐛 Bug Fixes

* **ci:** restore deploy permissions broken by the zizmor excessive-permissions fix ([#26](https://github.com/QNSC-VN/qnsc-kb-frontend/issues/26)) ([e0320ad](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/e0320addbfa2a163f30f4c81754a18a06d791ddb))
* **ci:** scope permissions, set persist-credentials, enforce zizmor ([#25](https://github.com/QNSC-VN/qnsc-kb-frontend/issues/25)) ([e1046aa](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/e1046aa9dd723036972db713e8719f620331ae9d))
* **codeowners:** point at the team that actually exists ([3239e6c](https://github.com/QNSC-VN/qnsc-kb-frontend/commit/3239e6c06ea24a3f592c6332358ef740db816509))
