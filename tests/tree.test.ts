import { describe, expect, test } from 'bun:test'
import {
	appendChild,
	findByType,
	findOverlayButton,
	insertBefore,
} from '../plugins/reverse-image-search/js/core/tree'

const Sheet = () => null
const Button = () => null
const button = (key: string) => ({
	key,
	type: Button,
	props: { accessibilityLabel: key, icon: {}, onPress() {} },
})

describe('findByType', () => {
	test('finds a nested element', () => {
		const sheet = { type: Sheet, props: {} }

		expect(
			findByType(
				{ props: { children: [null, { props: { children: sheet } }] } },
				Sheet,
			),
		).toBe(sheet)
	})

	test('returns nothing for odd or very deep trees', () => {
		let deep: unknown = { type: Sheet, props: {} }
		for (let index = 0; index < 40; index++)
			deep = { props: { children: deep } }

		expect(findByType(deep, Sheet)).toBeUndefined()
		expect(findByType(null, Sheet)).toBeUndefined()
	})
})

describe('appendChild', () => {
	test('keeps existing children and drops empties', () => {
		const parent = { props: { children: ['a', null] as unknown } }

		appendChild(parent, 'b')

		expect(parent.props.children).toEqual(['a', 'b'])
	})

	test('handles a single child', () => {
		const parent = { props: { children: 'a' as unknown } }

		appendChild(parent, 'b')

		expect(parent.props.children).toEqual(['a', 'b'])
	})
})

describe('overlay buttons', () => {
	test('finds the first button and inserts before it', () => {
		const close = button('close')
		const holder = { props: { children: ['title', close] as unknown[] } }
		const slot = findOverlayButton({ props: { children: holder } })

		expect(slot?.element).toBe(close)
		insertBefore(slot!, button('search'))
		expect(holder.props.children[1]).toMatchObject({ key: 'search' })
		expect(holder.props.children[2]).toBe(close)
	})

	test('does not add the same key twice', () => {
		const holder = { props: { children: [button('close')] as unknown[] } }
		const slot = findOverlayButton(holder)!

		insertBefore(slot, button('search'))
		insertBefore(slot, button('search'))

		expect(holder.props.children).toHaveLength(2)
	})

	test('handles a lone child that is not in an array', () => {
		const holder = { props: { children: button('close') as unknown } }
		const slot = findOverlayButton(holder)!

		insertBefore(slot, button('search'))

		expect(holder.props.children).toHaveLength(2)
	})

	test('returns nothing without a button', () => {
		expect(findOverlayButton({ props: { children: 'text' } })).toBeUndefined()
	})
})
