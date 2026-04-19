import * as THREE from 'three'

/**
 * SceneNode — base node in the Artlab scene graph.
 *
 * Every 3D object in an Artlab scene is a SceneNode.  The node wraps a
 * THREE.Object3D for visual representation and adds:
 *   - Parent/child tree management (mirrored to the Three.js hierarchy)
 *   - A component map for attaching arbitrary system data (physics body, etc.)
 *   - Convenience transform accessors
 *   - Depth-first traversal and find-by-id
 */
export class SceneNode {
  /**
   * @param {string} id    Unique identifier within the scene
   * @param {string} [name]  Human-readable display name (defaults to id)
   */
  constructor(id, name = id) {
    this.id = id
    this.name = name
    /** @type {SceneNode[]} */
    this.children = []
    /** @type {SceneNode|null} */
    this.parent = null
    /** @type {Record<string, any>} keyed by component type name */
    this.components = {}

    // Three.js representation — subclasses may replace this
    this.object3D = new THREE.Object3D()
    this.object3D.name = name
  }

  // -------------------------------------------------------------------------
  // Hierarchy
  // -------------------------------------------------------------------------

  /**
   * Add a child SceneNode.
   * @param {SceneNode} child
   * @returns {this}
   */
  add(child) {
    if (child.parent) {
      child.parent.remove(child)
    }
    child.parent = this
    this.children.push(child)
    this.object3D.add(child.object3D)
    return this
  }

  /**
   * Remove a child SceneNode.
   * @param {SceneNode} child
   * @returns {this}
   */
  remove(child) {
    const idx = this.children.indexOf(child)
    if (idx >= 0) {
      this.children.splice(idx, 1)
      child.parent = null
      this.object3D.remove(child.object3D)
    }
    return this
  }

  // -------------------------------------------------------------------------
  // Components
  // -------------------------------------------------------------------------

  /**
   * Attach a component under a named key.
   * @param {string} name  e.g. 'rigidBody', 'audioReactive'
   * @param {any} component
   * @returns {this}
   */
  addComponent(name, component) {
    this.components[name] = component
    return this
  }

  /**
   * Retrieve a component by name, or null if not present.
   * @param {string} name
   * @returns {any|null}
   */
  getComponent(name) {
    return this.components[name] ?? null
  }

  // -------------------------------------------------------------------------
  // Transform convenience accessors (proxy through to object3D)
  // -------------------------------------------------------------------------

  /** @type {THREE.Vector3} */
  get position() { return this.object3D.position }

  /** @type {THREE.Euler} */
  get rotation() { return this.object3D.rotation }

  /** @type {THREE.Vector3} */
  get scale() { return this.object3D.scale }

  /** @type {THREE.Quaternion} */
  get quaternion() { return this.object3D.quaternion }

  /**
   * World-space position (allocates a new Vector3 each call — cache externally if hot).
   * @type {THREE.Vector3}
   */
  get worldPosition() {
    const v = new THREE.Vector3()
    this.object3D.getWorldPosition(v)
    return v
  }

  /**
   * Set local position.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {this}
   */
  setPosition(x, y, z) {
    this.object3D.position.set(x, y, z)
    return this
  }

  /**
   * Set local scale.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {this}
   */
  setScale(x, y, z) {
    this.object3D.scale.set(x, y, z)
    return this
  }

  /** Visibility of this node and its descendants. */
  get visible() { return this.object3D.visible }
  set visible(v) { this.object3D.visible = v }

  // -------------------------------------------------------------------------
  // Search / traversal
  // -------------------------------------------------------------------------

  /**
   * Depth-first search by id.
   * @param {string} id
   * @returns {SceneNode|null}
   */
  findById(id) {
    if (this.id === id) return this
    for (const child of this.children) {
      const found = child.findById(id)
      if (found) return found
    }
    return null
  }

  /**
   * Depth-first search by name.
   * @param {string} name
   * @returns {SceneNode|null}
   */
  findByName(name) {
    if (this.name === name) return this
    for (const child of this.children) {
      const found = child.findByName(name)
      if (found) return found
    }
    return null
  }

  /**
   * Call fn(node) for this node and all descendants (depth-first, pre-order).
   * @param {(node: SceneNode) => void} fn
   */
  traverse(fn) {
    fn(this)
    for (const child of this.children) child.traverse(fn)
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Dispose geometry and materials on this node and all descendants.
   * Call when permanently removing a subtree from the scene.
   */
  dispose() {
    // Children first (bottom-up)
    for (const child of this.children) child.dispose()

    const obj = this.object3D
    if (obj.geometry) {
      obj.geometry.dispose()
    }
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach(m => m.dispose())
    }
  }
}

/**
 * RootScene — the top-level node that owns the THREE.Scene.
 * Every scene graph has exactly one RootScene at its root.
 */
export class RootScene extends SceneNode {
  constructor() {
    super('__root__', 'Scene')
    this.threeScene = new THREE.Scene()
    this.threeScene.background = new THREE.Color(0x000005)
    // Replace the default Object3D with the actual Three.js scene
    this.object3D = this.threeScene
  }
}
