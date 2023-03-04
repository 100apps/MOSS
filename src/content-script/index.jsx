import './styles.scss'
import { render } from 'preact'
import ChatGPTCard from './ChatGPTCard'
import { config as siteConfig } from './search-engine-configs.mjs'
import { getPossibleElementByQuerySelector, isSafari } from '../utils.mjs'
import { clearOldAccessToken, getUserConfig, setAccessToken } from '../config'

/**
 * @param {SiteConfig} siteConfig
 * @param {UserConfig} userConfig
 */
async function mountComponent(siteConfig, userConfig) {
  let question
  if (userConfig.inputQuery) question = getSearchInputValue([userConfig.inputQuery])
  if (!question && siteConfig) question = getSearchInputValue(siteConfig.inputQuery)

  const container = document.createElement('div')
  container.className = 'chat-gpt-container'
  render(
    <ChatGPTCard question={question} siteConfig={siteConfig} container={container} />,
    container,
  )
}

/**
 * @param {string[]} inputQuery
 * @returns {string}
 */
function getSearchInputValue(inputQuery) {
  const searchInput = getPossibleElementByQuerySelector(inputQuery)
  if (searchInput && searchInput.value) {
    return searchInput.value
  }
}

async function prepareForSafari() {
  await clearOldAccessToken()

  if (location.hostname !== 'chat.openai.com' || location.pathname !== '/api/auth/session') return

  const response = document.querySelector('pre').textContent

  let data
  try {
    data = JSON.parse(response)
  } catch (error) {
    console.error('json error', error)
    return
  }
  if (data.accessToken) {
    await setAccessToken(data.accessToken)
  }
}

async function run() {
  if (isSafari()) await prepareForSafari()

  const userConfig = await getUserConfig()
  let siteRegex
  if (userConfig.userSiteRegexOnly) siteRegex = userConfig.siteRegex
  else
    siteRegex = new RegExp(
      (userConfig.siteRegex && userConfig.siteRegex + '|') + Object.keys(siteConfig).join('|'),
    )

  const matches = location.hostname.match(siteRegex)
  if (matches) {
    const siteName = matches[0]
    if (siteName in siteConfig) {
      const siteAction = siteConfig[siteName].action
      if (siteAction && siteAction.init) {
        siteAction.init(location.hostname, userConfig, getSearchInputValue, mountComponent)
      }
    }
    mountComponent(siteConfig[siteName], userConfig)
  }
}

run()

function getPrompt(command, selectionText) {
  switch (command) {
    case 'prompt 生成':
      return '生成 10 条关于' + selectionText + '的 prompts，可以给 ChatGPT 作为输入'
    case '内容提炼':
      return '对一下内容进行总结: ' + selectionText
    case '文本分类':
      return '请对以下文本进行分类，并给出分类原因: ' + selectionText
    case '文字润色':
      return '对一下文字进行润色: ' + selectionText
    case '批判性分析':
      return '请用批判性思维评价以下观点: ' + selectionText
    default:
      return selectionText
  }
}
chrome.runtime.onMessage.addListener((request) => {
  const command = request.info.menuItemId
  const selectionText = request.info.selectionText

  const question = getPrompt(command, selectionText)

  const container = document.createElement('div')
  container.className = 'chat-gpt-container'
  container.id = 'chat-gpt-container-id'
  const selectionRect = window.getSelection().getRangeAt(0).getBoundingClientRect()
  container.style.left = selectionRect.x + 'px'
  container.style.top = selectionRect.y + 'px'

  document.body.prepend(container)

  render(<ChatGPTCard question={question} container={container} />, container)
})
