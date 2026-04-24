import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { logout } from '../lib/auth'
import AiChat from './AiChat'
import OtherPortals from './OtherPortals'
import ProfileDropdown from './ProfileDropdown'
import api from '../lib/api'

// ── SVG icon library (Heroicons outline 24x24) ───────────────────────────────
const NAV_ICONS = {
  home:          'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  building:      'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
  users:         'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  chart_bar:     'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  search:        'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  document:      'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  wrench:        'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  calendar:      'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  rocket:        'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
  eye:           'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  clipboard:     'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
  check_circle:  'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  currency:      'M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  banknotes:     'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
  bank:          'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z',
  calculator:    'M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.652 4.5 4.756V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.756c0-1.104-.807-2.057-1.907-2.184A48.507 48.507 0 0012 2.25z',
  shield:        'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  id_card:       'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z',
  scale:         'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z',
  folder:        'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  sparkle:       'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  briefcase:     'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
  bell:          'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  arrow_path:    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  exclamation:   'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  trending_up:   'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
  user_minus:    'M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  tag:           'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
  leaf:          'M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 01-1.652.928l-.679-.906a1.125 1.125 0 00-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 00-8.862 12.872M12.75 3.031a9 9 0 016.69 14.036m0 0l-.177-.529A2.249 2.249 0 0017.5 15.32m-.177 2.146a9 9 0 01-10.4-4.67',
  star:          'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  pencil:        'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
  envelope:      'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  phone:         'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  newspaper:     'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  bolt:          'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  cog:           'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  lock:          'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
}

function NavIcon({ name, className = 'w-4 h-4' }) {
  const d = NAV_ICONS[name]
  if (!d) return null
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      {d.includes('M15 12') && d.includes('M9.594') ? (
        // cog has two paths
        d.split(' M').map((p, i) => i === 0
          ? <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />
          : <path key={i} strokeLinecap="round" strokeLinejoin="round" d={'M' + p} />
        )
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      )}
    </svg>
  )
}

function getGroups(t) {
  return [
    {
      label: 'Portfolio', icon: 'home',
      items: [
        { to: '/landlords',      label: 'Landlords',         icon: 'building' },
        { to: '/properties',     label: t('nav.properties'), icon: 'home' },
        { to: '/tenants',        label: t('nav.tenants'),    icon: 'users' },
        { to: '/meter-readings', label: 'Meter Readings',    icon: 'chart_bar' },
        { to: '/applicants',     label: t('nav.applicants'), icon: 'search' },
        { to: '/leases',         label: t('nav.leases'),     icon: 'document' },
      ],
    },
    {
      label: 'Operations', icon: 'wrench',
      items: [
        { to: '/contractors', label: t('nav.contractors'), icon: 'wrench' },
        { to: '/maintenance', label: t('nav.maintenance'), icon: 'wrench' },
        { to: '/ppm',         label: t('nav.ppm'),         icon: 'calendar' },
        { to: '/dispatch',    label: t('nav.dispatch'),    icon: 'rocket' },
        { to: '/inspections', label: t('nav.inspections'), icon: 'eye' },
        { to: '/inventory',   label: t('nav.inventory'),   icon: 'clipboard' },
        { to: '/checklists',  label: 'Checklists',          icon: 'check_circle' },
      ],
    },
    {
      label: 'Finance', icon: 'currency',
      items: [
        { to: '/payments',    label: t('nav.payments'),    icon: 'banknotes' },
        { to: '/deposits',    label: t('nav.deposits'),    icon: 'bank' },
        { to: '/accounting',  label: t('nav.accounting'),  icon: 'calculator' },
        { to: '/tax-summary', label: 'Tax Summary',        icon: 'calculator' },
      ],
    },
    {
      label: 'Compliance & Legal', icon: 'shield',
      items: [
        { to: '/compliance',      label: t('nav.compliance'),  icon: 'shield' },
        { to: '/right-to-rent',   label: 'Right to Rent',      icon: 'id_card' },
        { to: '/notices',         label: t('nav.notices'),     icon: 'scale' },
        { to: '/deposit-dispute', label: 'Deposit Dispute',    icon: 'scale' },
        { to: '/documents',       label: t('nav.documents'),   icon: 'folder' },
      ],
    },
    {
      label: 'Intelligence', icon: 'sparkle',
      items: [
        { to: '/analytics',             label: t('nav.analytics'),   icon: 'chart_bar' },
        { to: '/cfo',                   label: 'CFO Dashboard',      icon: 'briefcase' },
        { to: '/alerts',                label: t('nav.alerts'),      icon: 'bell' },
        { to: '/renewals',              label: t('nav.renewals'),    icon: 'arrow_path' },
        { to: '/risk',                  label: t('nav.risk'),        icon: 'exclamation' },
        { to: '/rent-optimisation',     label: 'Rent Optimiser',     icon: 'trending_up' },
        { to: '/churn-risk',            label: 'Churn Risk',         icon: 'user_minus' },
        { to: '/void-minimiser',        label: 'Void Minimiser',     icon: 'home' },
        { to: '/valuation',             label: t('nav.valuation'),   icon: 'tag' },
        { to: '/epc-roadmap',           label: 'EPC Roadmap',        icon: 'leaf' },
        { to: '/contractor-performance',label: 'Contractor Perf.',   icon: 'star' },
        { to: '/listing-generator',     label: 'Listing Generator',  icon: 'pencil' },
        { to: '/insurance-claims',      label: 'Insurance Claims',   icon: 'shield' },
        { to: '/lease-analyser',        label: 'Lease Analyser',     icon: 'search' },
        { to: '/email-triage',          label: 'Email Triage',       icon: 'envelope' },
        { to: '/phone-agent',           label: 'AI Phone Agent',     icon: 'phone' },
        { to: '/surveys',               label: 'Surveys',            icon: 'star' },
      ],
    },
    {
      label: 'Admin', icon: 'cog',
      items: [
        { to: '/files',      label: t('nav.files'),      icon: 'folder' },
        { to: '/news',       label: t('nav.news'),       icon: 'newspaper' },
        { to: '/autopilot',  label: 'AI Autopilot',      icon: 'bolt' },
        { to: '/workflows',  label: 'Workflows',         icon: 'cog' },
        { to: '/audit-log',  label: 'Audit Trail',       icon: 'lock' },
        { to: '/settings',   label: t('nav.settings'),   icon: 'cog' },
      ],
    },
  ]
}

function NavGroup({ group, currentPath }) {
  const isActive = group.items.some(i => currentPath.startsWith(i.to))
  const [open, setOpen] = useState(isActive)

  useEffect(() => { if (isActive) setOpen(true) }, [currentPath])

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors text-left cursor-pointer ${
          isActive ? 'text-indigo-300' : 'text-indigo-600 hover:text-indigo-400'
        }`}
      >
        <span className="flex items-center gap-2">
          <NavIcon name={group.icon} className="w-3.5 h-3.5" />
          {group.label}
        </span>
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-0.5 mb-1 ml-2 space-y-0.5 border-l border-indigo-900 pl-2">
          {group.items.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
                }`
              }
            >
              <NavIcon name={icon} className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {badge > 0 && (
                <span className="bg-violet-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center shrink-0">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// Roles that can see each nav group (absent = all roles allowed)
const GROUP_ROLE_GATES = {
  'Finance':      new Set(['admin', 'manager', 'accounts', 'read_only', 'agent']),
  'Operations':   new Set(['admin', 'manager', 'negotiator', 'read_only', 'agent']),
  'Intelligence': new Set(['admin', 'manager', 'read_only', 'agent']),
}

// Map route paths to feature flag keys
const ROUTE_FLAGS = {
  '/analytics': 'agent_analytics',
  '/cfo': 'agent_cfo',
  '/alerts': 'agent_alerts',
  '/renewals': 'agent_renewals',
  '/accounting': 'agent_accounting',
  '/dispatch': 'agent_dispatch',
  '/ppm': 'agent_ppm',
  '/audit-log': 'agent_audit_log',
  '/workflows': 'agent_workflows',
  '/checklists': 'agent_checklists',
  '/risk': 'agent_ai_tools',
  '/rent-optimisation': 'agent_ai_tools',
  '/churn-risk': 'agent_ai_tools',
  '/void-minimiser': 'agent_ai_tools',
  '/epc-roadmap': 'agent_ai_tools',
  '/contractor-performance': 'agent_ai_tools',
  '/listing-generator': 'agent_ai_tools',
  '/insurance-claims': 'agent_ai_tools',
  '/lease-analyser': 'agent_ai_tools',
  '/email-triage': 'agent_ai_tools',
  '/phone-agent': 'agent_ai_tools',
  '/surveys': 'agent_ai_tools',
  '/valuation': 'agent_ai_tools',
}

export default function Layout({ children }) {
  const [me, setMe] = useState(null)
  const [totalUnread, setTotalUnread] = useState(0)
  const [navFeatures, setNavFeatures] = useState({})
  const location = useLocation()
  const { t } = useTranslation()

  useEffect(() => { api.get('/auth/me').then(r => setMe(r.data)).catch(() => {}) }, [])
  useEffect(() => { api.get('/settings/features').then(r => {
    const flags = {}
    for (const items of Object.values(r.data.groups || {}))
      for (const f of items) flags[f.key] = f.enabled
    setNavFeatures(flags)
  }).catch(() => {}) }, [])

  useEffect(() => {
    function fetchUnread() {
      Promise.all([
        api.get('/tenants/messages/inbox').catch(() => ({ data: [] })),
        api.get('/landlord/messages/inbox').catch(() => ({ data: [] })),
        api.get('/contractors/messages/inbox').catch(() => ({ data: [] })),
      ]).then(([t, l, c]) => {
        const total =
          t.data.reduce((s, x) => s + (x.unread || 0), 0) +
          l.data.reduce((s, x) => s + (x.unread || 0), 0) +
          c.data.reduce((s, x) => s + (x.unread || 0), 0)
        setTotalUnread(total)
      })
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [])

  const userRole = me?.role || 'agent'
  const groups = getGroups(t).map(g => ({
    ...g,
    items: g.items.filter(item => {
      const flag = ROUTE_FLAGS[item.to]
      if (!flag) return true
      return navFeatures[flag] !== false
    })
  })).filter(g => {
    if (g.items.length === 0) return false
    const gate = GROUP_ROLE_GATES[g.label]
    if (!gate) return true
    return gate.has(userRole)
  })

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-60 bg-indigo-950 flex flex-col shrink-0">
          <div className="px-5 py-5 border-b border-indigo-900">
            <NavLink to="/dashboard" className="block">
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-indigo-300">Prop</span><span className="text-white">AI</span><span className="text-indigo-300">rty</span>
              </h1>
              <p className="text-xs text-indigo-500 mt-0.5">Agent Portal</p>
            </NavLink>
          </div>

          <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer mb-1 ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
                }`
              }
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span className="flex-1">{t('nav.dashboard')}</span>
              {totalUnread > 0 && (
                <span className="bg-violet-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center shrink-0">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </NavLink>

            {groups.map(group => (
              <NavGroup key={group.label} group={group} currentPath={location.pathname} />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto flex flex-col">
          <header className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between sticky top-0 z-10 shrink-0">
            <span className="text-sm text-gray-400">{me?.organisation_name}</span>
            <div className="flex items-center gap-4">
              {me && (
                <ProfileDropdown
                  me={me}
                  onUpdate={async (patch) => { const r = await api.patch('/auth/me', patch); setMe(r.data) }}
                  onPassword={async ({ current, next }) => api.post('/auth/me/change-password', { current_password: current, new_password: next })}
                  onLogout={logout}
                  accentRing="focus:ring-indigo-500"
                  btnClass="bg-indigo-600 hover:bg-indigo-700"
                  hasPhone={false}
                />
              )}
            </div>
          </header>
          <div className="p-8 flex-1">{children}</div>
        </main>
      </div>

      <OtherPortals current="agent" />
      <AiChat />
    </div>
  )
}
