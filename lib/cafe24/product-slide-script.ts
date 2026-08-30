/**
 * 상품 슬라이드 진열의 Swiper init입니다.
 *
 * 설정값은 reference/cafe24-product-slide/*의 skin19 layout/basic/js/main.js에 있는
 * `new Swiper('.special_slide', {...})`를 그대로 옮긴 것입니다.
 * Swiper 본체는 base skin(Guide/skin4)이 이미 /js/swiper-bundle.js(4.5.1)로 싣고 있어
 * 추가로 배포하지 않습니다. reference skin19도 같은 4.5.1을 씁니다.
 *
 * reference는 jQuery(document).ready 안에서 실행하지만, base skin에는 jQuery 로드가
 * 보장되지 않으므로 같은 시점을 DOMContentLoaded로만 바꿉니다.
 */
export const PRODUCT_SLIDE_SCRIPT_PATH = "js/moire-product-slide.js";

export const PRODUCT_SLIDE_SCRIPT = `/* MOLIVE 상품 슬라이드 진열. Cafe24 skin19 main.js의 special_slide 설정을 그대로 씁니다. */
(function () {
  function init() {
    if (typeof window.Swiper !== "function") return;
    var containers = document.querySelectorAll(".moireProductSlide .special_slide");
    for (var index = 0; index < containers.length; index += 1) {
      var container = containers[index];
      if (container.className.indexOf("swiper-container-initialized") >= 0) continue;
      new window.Swiper(container, {
        slidesPerView: "auto",
        spaceBetween: 20,
        observer: true,
        observeParents: true,
        speed: 700,
        scrollbar: {
          el: ".swiper-scrollbar",
          hide: false,
          draggable: true
        },
        navigation: {
          nextEl: ".swiper-next-special",
          prevEl: ".swiper-prev-special"
        },
        autoplay: {
          delay: 5000,
          disableOnInteraction: false
        },
        breakpoints: {
          768: {
            slidesPerView: "auto",
            spaceBetween: 10
          }
        }
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
`;
