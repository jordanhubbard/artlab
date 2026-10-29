/** Searchable source navigation; selecting a file opens its editable workspace copy. */
export class SourceBrowser {
  constructor(parent, library, open) {
    const root = document.createElement('details')
    root.id = 'environment-source'
    root.style.cssText = 'padding:10px 8px;border-top:1px solid #25334b;font:11px monospace'
    const title = document.createElement('summary')
    title.textContent = 'Environment source'
    title.style.cursor = 'pointer'
    const search = document.createElement('input')
    search.type = 'search'
    search.placeholder = 'Find a class or module…'
    search.setAttribute('aria-label', 'Search environment source')
    search.style.cssText = 'box-sizing:border-box;width:100%;margin:10px 0;padding:6px;background:#0f1522;color:#dceaff;border:1px solid #354564'
    const list = document.createElement('div')
    list.style.cssText = 'max-height:340px;overflow:auto'
    const hint = document.createElement('p')
    hint.textContent = 'Open a module to explore or edit it. Run rebuilds the scene with your changes.'
    hint.style.cssText = 'color:#91a3bd;line-height:1.5'
    const render = () => {
      list.replaceChildren()
      for (const path of library.list('src/').filter(path => path.toLowerCase().includes(search.value.toLowerCase()))) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = path.slice(4)
        button.title = path
        button.style.cssText = 'display:block;text-align:left;width:100%;padding:5px 0;border:0;background:transparent;color:#a8c9fa;font:11px monospace;cursor:pointer;overflow-wrap:anywhere'
        button.addEventListener('click', () => open(path))
        list.appendChild(button)
      }
    }
    search.addEventListener('input', render)
    root.append(title, hint, search, list)
    parent.prepend(root)
    render()
    this.element = root
  }
}
