interface Node {
	type?: unknown
	key?: unknown
	props?: { children?: unknown; [key: string]: unknown }
}

const MaxDepth = 14

const isNode = (value: unknown): value is Node =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export function findByType(
	tree: unknown,
	type: unknown,
	depth = 0,
): Node | undefined {
	if (depth > MaxDepth) return

	if (Array.isArray(tree)) {
		for (const child of tree) {
			const found = findByType(child, type, depth + 1)
			if (found) return found
		}
		return
	}

	if (!isNode(tree)) return
	if (tree.type === type) return tree

	return findByType(tree.props?.children, type, depth + 1)
}

export function appendChild(parent: Node, child: unknown) {
	if (!parent.props) return

	parent.props.children = [
		...[parent.props.children].flat().filter(Boolean),
		child,
	]
}

const isOverlayButton = (node: Node) =>
	typeof node.props?.onPress === 'function' &&
	node.props.icon != null &&
	'accessibilityLabel' in node.props

export interface OverlayButtonSlot {
	holder: Node
	element: Node
	index: number
}

export function findOverlayButton(
	tree: unknown,
	depth = 0,
): OverlayButtonSlot | undefined {
	if (!isNode(tree) || depth > MaxDepth) return

	const children = [tree.props?.children].flat()

	for (const [index, child] of children.entries()) {
		if (!isNode(child)) continue
		if (isOverlayButton(child)) return { holder: tree, element: child, index }

		const found = findOverlayButton(child, depth + 1)
		if (found) return found
	}
}

export function insertBefore(
	{ holder, index }: OverlayButtonSlot,
	child: unknown,
) {
	if (!holder.props) return

	const children = [holder.props.children].flat()
	if (children.some(item => isNode(item) && item.key === (child as Node).key))
		return

	children.splice(index, 0, child)
	holder.props.children = children
}
