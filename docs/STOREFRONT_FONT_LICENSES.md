# MOLIVE Storefront Font Audit

Last verified: 2026-08-30

## Existing selector audit

The previous editor exposed `Sans` (`Arial, sans-serif`), `Pretendard`, `Serif` (`Georgia, serif`) and a generic `Mono` option. Arial and Georgia are operating-system fonts, while `monospace` is only a generic CSS family. They do not provide font files that MOLIVE can license and redistribute in a Cafe24 ZIP. Pretendard is OFL-licensed, but the project did not self-host or package its file. The new pool therefore keeps Pretendard as a canonical self-hosted option and replaces the generic choices with nine concrete, licensed families.

## License decision

Every selected family is distributed under the SIL Open Font License 1.1. OFL permits commercial use and web embedding. It also permits modified and unmodified font software to be bundled and redistributed with software, provided the copyright notice and license accompany each copy and the font is not sold by itself. MOLIVE satisfies that condition by putting the exact `OFL.txt` next to every family in both `public/fonts/storefront` and the generated Cafe24 ZIP.

`official-woff2` means the WOFF2 came directly from the author's official repository. `ofl-format-conversion` means the official Google Fonts TTF was converted only to WOFF2; the original OFL permits modification and redistribution, and its license text remains adjacent to the converted file.

| Font | Role and mood | Official distribution | License | Packaged form |
| --- | --- | --- | --- | --- |
| Pretendard | General gothic; modern, premium | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) | [SIL OFL 1.1](https://github.com/orioncactus/pretendard/blob/main/LICENSE) | Official variable WOFF2 |
| Noto Sans KR | Neutral gothic; modern, friendly | [Google Fonts / Noto Sans KR](https://github.com/google/fonts/tree/main/ofl/notosanskr) | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt) | Official variable TTF → WOFF2 |
| IBM Plex Sans KR | Technical gothic; technical, modern | [IBM Plex Sans KR](https://github.com/IBM/plex/tree/master/packages/plex-sans-kr) | [SIL OFL 1.1](https://github.com/IBM/plex/blob/master/packages/plex-sans-kr/LICENSE.txt) | Official Regular/Bold WOFF2 |
| Gowun Dodum | Soft rounded gothic; friendly, warm | [Google Fonts / Gowun Dodum](https://github.com/google/fonts/tree/main/ofl/gowundodum) | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/gowundodum/OFL.txt) | Official TTF → WOFF2 |
| Jua | Rounded display; playful, friendly | [Google Fonts / Jua](https://github.com/google/fonts/tree/main/ofl/jua) | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/jua/OFL.txt) | Official TTF → WOFF2 |
| Black Han Sans | Heavy display; bold, modern | [Google Fonts / Black Han Sans](https://github.com/google/fonts/tree/main/ofl/blackhansans) | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/blackhansans/OFL.txt) | Official TTF → WOFF2 |
| Noto Serif KR | Editorial serif; editorial, premium | [Google Fonts / Noto Serif KR](https://github.com/google/fonts/tree/main/ofl/notoserifkr) | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/notoserifkr/OFL.txt) | Official variable TTF → WOFF2 |
| Gowun Batang | Warm serif; warm, editorial | [Google Fonts / Gowun Batang](https://github.com/google/fonts/tree/main/ofl/gowunbatang) | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/gowunbatang/OFL.txt) | Official Regular/Bold TTF → WOFF2 |
| Hahmlet | Contemporary serif display; premium, editorial | [Google Fonts / Hahmlet](https://github.com/google/fonts/tree/main/ofl/hahmlet) | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/hahmlet/OFL.txt) | Official variable TTF → WOFF2 |

## Runtime and export contract

- The editor options, AI JSON Schema/prompt, Preview `@font-face` declarations and Cafe24 `@font-face` declarations are generated from `lib/fonts/storefront-fonts.ts`.
- Preview loads `/fonts/storefront/<family>/<file>.woff2` from `public`.
- Cafe24 CSS loads `../fonts/storefront/<family>/<file>.woff2` from the ZIP's `css` directory.
- Export reads those same public files byte-for-byte and writes them to `fonts/storefront` in the ZIP, including each `OFL.txt`.
- Existing saved legacy font strings remain accepted so old projects do not lose typography, but they are no longer offered for new selection or AI generation.
