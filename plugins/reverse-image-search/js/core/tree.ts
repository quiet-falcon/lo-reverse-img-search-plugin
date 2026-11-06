interface Node {
	type?: unknown
	key?: unknown
	props?: { children?: unknown; [key: string]: unknown }
}

const MaxDepth = 14
const DescribeDepth = 4
const MaxDescribed = 40

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

const nameOf = (type: unknown) => {
	if (typeof type === 'string') return type
	if (typeof type === 'function')
		return (
			(type as { displayName?: string }).displayName || type.name || 'Anonymous'
		)
	if (typeof type === 'object' && type !== null) return 'Wrapped'
	return 'Unknown'
}

// Component names and prop keys only, for device diagnostics
export function describeTree(tree: unknown) {
	const lines: string[] = []

	const visit = (node: unknown, depth: number) => {
		if (depth > DescribeDepth || lines.length >= MaxDescribed) return
		if (Array.isArray(node)) {
			for (const child of node) visit(child, depth)
			return
		}
		if (!isNode(node)) return

		const keys = Object.keys(node.props ?? {})
			.sort()
			.join(' ')
		lines.push(`${depth}:${nameOf(node.type)}(${keys})`)
		visit(node.props?.children, depth + 1)
	}

	visit(tree, 0)
	return lines
}
