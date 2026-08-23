export const CAFE24_FOOTER_HTML = `<footer id="footer">
    <h2 class="blind">회사정보</h2>
    <div class="inner">
        <div module="Layout_footer">
            <!--@css(/css/module/layout/footer.css)-->
            <ul class="util">
                <li><a href="/index.html">Home</a></li>
                <li><a href="/shopinfo/company.html">About Us</a></li>
                <li><a href="/member/mall_agreement.html">Terms&amp;Conditions</a></li>
                <li><a href="/member/privacy.html"><strong>Privacy Policy</strong></a></li>
                <li><a href="/shopinfo/guide.html">Help</a></li>
            </ul>
            <div class="sns">
                <a href="#none"><!--@import(/svg/icon-instagram.html)-->instagram</a>
                <a href="#none"><!--@import(/svg/icon-facebook.html)-->facebook</a>
                <a href="#none"><!--@import(/svg/icon-youtube.html)-->youtube</a>
                <a href="#none"><!--@import(/svg/icon-kakao.html)-->kakao</a>
            </div>
            <div class="info">
                <div class="info__address">
                    <h3 class="title RW">Company info</h3>
                    <span>법인명(상호) : {$company_name} </span> <span>대표자(성명) : {$president_name}</span> <span>사업자 등록번호 안내 : [{$company_regno}]</span> <span>통신판매업 신고 {$network_regno}</span> <span>{$biz_no_link}</span> <br />
                    <span>전화 : {$phone}</span> <span>팩스 : {$fax}</span> <span>주소 : {$mall_zipcode} {$mall_addr1} {$mall_addr2}</span><br />
                    <span class="{$cpo_email|display}">개인정보보호책임자 : <a href="mailto:{$cpo_email}">{$cpo_name}({$cpo_email})</a></span><br />
                    <span>Contact <a href="mailto:{$email}">{$email}</a> for more information.</span>
                </div>
                <div module="Layout_Info" class="info__customer">
                    <div class="heading">
                        <h3 class="title">Customer</h3>
                        <button type="button" class="toggle"><i aria-hidden="true" class="icon icoArrowBottom"></i>open</button>
                    </div>
                    <ul class="content">
                        <li class="tel">{$phone}</li>
                        <li class="runtime">{$runtime}</li>
                    </ul>
                </div>
                <div class="info__community RW">
                    <h3 class="title">Community</h3>
                    <ul>
                        <li><a href="/board/free/list.html?board_no=1">Notice</a></li>
                        <li><a href="/board/product/list.html?board_no=4">Review</a></li>
                        <li><a href="/board/product/list.html?board_no=6">Q&amp;A</a></li>
                        <li><a href="/board/free/list.html?board_no=3">FAQ</a></li>
                    </ul>
                </div>
            </div>
            <p class="copyright">Copyright &copy; <strong>{$mall_name}</strong>. All rights reserved. Hosting by <span class="hosting">cafe24</span></p>
        </div>
    </div>
</footer>`;

const FOOTER_PREVIEW_BINDINGS: ReadonlyArray<readonly [string, string]> = [
  ["{$company_name}", "아이보리 프레임 주식회사"],
  ["{$president_name}", "김모아"],
  ["{$company_regno}", "123-45-67890"],
  ["{$network_regno}", "2026-서울성동-0123"],
  ["{$biz_no_link}", "사업자정보확인"],
  ["{$phone}", "02-1234-5678"],
  ["{$fax}", "02-1234-5679"],
  ["{$mall_zipcode}", "04782"],
  ["{$mall_addr1}", "서울특별시 성동구"],
  ["{$mall_addr2}", "성수이로 24"],
  ["{$cpo_email|display}", "__binding__"],
  ["{$cpo_email}", "privacy@example.com"],
  ["{$cpo_name}", "김모아"],
  ["{$email}", "hello@example.com"],
  ["{$runtime}", "평일 10:00–17:00 / 점심 12:00–13:00"],
  ["{$mall_name}", "IVORY FRAME"],
];

export function renderFooterShell(target: "preview" | "cafe24") {
  if (target === "cafe24") return CAFE24_FOOTER_HTML;
  let html = CAFE24_FOOTER_HTML
    .replace('<div module="Layout_footer">', '<div module="Layout_footer" class="xans-element- xans-layout xans-layout-footer">')
    .replace('<div module="Layout_Info" class="info__customer">', '<div module="Layout_Info" class="xans-element- xans-layout xans-layout-info info__customer">');
  for (const [binding, value] of FOOTER_PREVIEW_BINDINGS) html = html.replaceAll(binding, value);
  if (/\{\$/.test(html)) throw new Error("Footer Preview mock에 치환되지 않은 Cafe24 variable이 남아 있습니다.");
  return html;
}

export function extractFooterShell(html: string) {
  const start = html.indexOf('<footer id="footer">');
  const close = start < 0 ? -1 : html.indexOf("</footer>", start);
  if (start < 0 || close < 0) throw new Error("Guide footer shell을 찾지 못했습니다.");
  return html.slice(start, close + "</footer>".length);
}

export function replaceFooterShell(html: string, shell = CAFE24_FOOTER_HTML) {
  const current = extractFooterShell(html);
  return html.replace(current, shell);
}

/** Guide layout.css와 footer.css에서 Footer shell에 적용되는 선언입니다. */
export const FOOTER_SHELL_CSS = `#footer{position:relative;background:#f6f6f6}
#footer .inner{overflow:hidden;position:relative}
#footer .blind{display:block;overflow:hidden;position:absolute;font-size:1px;line-height:0;color:transparent;text-indent:-150%;white-space:nowrap}
.xans-layout-footer{position:relative}
.xans-layout-footer ul,.xans-layout-footer li,.xans-layout-footer h2,.xans-layout-footer h3,.xans-layout-footer p{margin:0;padding:0;list-style:none}
.xans-layout-footer .util{overflow:hidden}
.xans-layout-footer .util li{display:inline-block}
.xans-layout-footer .util li a{color:#000;text-transform:uppercase}
.xans-layout-footer .info__address{color:#757575;line-height:24px}
.xans-layout-footer .info__address span{display:inline-block;padding:0 25px 0 0;color:#6d6d6d}
.xans-layout-footer .info__address span a{color:#6d6d6d}
.xans-layout-footer .sns a{overflow:hidden;display:inline-block;width:20px;height:20px;margin-right:18px;white-space:nowrap;font-size:1px;line-height:1px;color:transparent;text-indent:150%;vertical-align:top}
.xans-layout-footer .copyright{color:#6d6d6d}.xans-layout-footer .hosting{color:#000}
@media all and (max-width:767px){.xans-layout-footer{padding:0 16px}.xans-layout-footer .util{margin:30px 0 20px}.xans-layout-footer .util li{margin:0 17px 0 0}.xans-layout-footer .util li a{display:block;font-size:14px;line-height:34px}.xans-layout-footer .info__address span{font-size:12px;line-height:19px}.xans-layout-footer .copyright{margin:10px 0 0;font-size:11px}}
@media all and (max-width:1024px){#footer{padding:0 0 82px}.xans-layout-footer .sns{margin:20px 0 30px}.xans-layout-footer .info{display:flex;flex-direction:column-reverse}.xans-layout-footer .info__customer{margin:0 -24px;padding:30px 24px;border-top:1px solid #e0e0e0}.xans-layout-footer .info__customer .content{overflow:hidden;visibility:hidden;height:0}.xans-layout-footer .info__community{display:none}}
@media all and (min-width:768px) and (max-width:1024px){.xans-layout-footer{padding:0 24px}.xans-layout-footer .util{margin:30px 0}.xans-layout-footer .util li{margin:0 20px 0 0}.xans-layout-footer .copyright{margin:20px 0 0;font-size:13px}}
@media all and (min-width:1025px){#footer{padding:40px 0 44px}#footer:before{content:"";display:block;position:absolute;bottom:100px;left:0;right:0;border-top:1px solid #e0e0e0}#footer .inner{max-width:1340px;margin:0 auto;padding:0 50px}.xans-layout-footer .util li a{display:block;margin-right:30px;font-size:15px;line-height:30px}.xans-layout-footer .info{display:flex;margin:30px 0 0}.xans-layout-footer .info .title{display:block;color:#000;margin:0 0 24px;font-size:16px}.xans-layout-footer .info__address{flex:1;padding:0 20px 0 0}.xans-layout-footer .info__address span{font-size:14px;line-height:30px}.xans-layout-footer .info__customer{width:308px;padding:0 20px 0 0;box-sizing:border-box}.xans-layout-footer .info__customer .toggle{display:none}.xans-layout-footer .info__customer .tel{font-size:20px}.xans-layout-footer .info__customer .runtime{margin:14px 0 0;font-size:14px;line-height:30px}.xans-layout-footer .info__community a{display:block;margin:2px 0;padding:6px 0;font-size:14px;color:#6d6d6d}.xans-layout-footer .sns{position:absolute;right:0;bottom:0}.xans-layout-footer .copyright{margin:84px 0 0;font-size:13px}}`;
