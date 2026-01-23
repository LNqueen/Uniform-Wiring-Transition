/**
  * Uniform Wiring Transition Plugin
 *
 * @version 1.2.0
 * Features:
 * - Unit selection (mm/mil)
 * - Start/End point selection for transition
 */

import * as extensionConfig from '../extension.json';

// ============================================================================
// Unit Conversion
// ============================================================================

const MIL_PER_MM = 39.3701;

type UnitType = 'mm' | 'mil';

let currentUnit: UnitType = 'mm';

function toMil(value: number, unit: UnitType): number {
	return unit === 'mm' ? value * MIL_PER_MM : value;
}

function fromMil(mil: number, unit: UnitType): number {
	return unit === 'mm' ? mil / MIL_PER_MM : mil;
}

function formatValue(mil: number): string {
	const value = fromMil(mil, currentUnit);
	return `${value.toFixed(currentUnit === 'mm' ? 3 : 1)}${currentUnit}`;
}

// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
	MAX_SEGMENTS: 50,
	MIN_SEGMENT_LENGTH_MM: 0.2,
	MIN_WIDTH_CHANGE_MM: 0.05,
	DEFAULT_TRANSITION_LENGTH_MM: 5,
	DEFAULT_TARGET_WIDTH_MM: 0.5,
};

// ============================================================================
// Utility Functions
// ============================================================================

interface Point {
	x: number;
	y: number;
}

interface LinePrimitive {
	globalIndex: number;
	layerId: string;
	width: number;
	locked: boolean;
	net: string;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	pcbItemPrimitiveType: string;
}

function getDistance(p1: Point, p2: Point): number {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function normalizeVector(v: Point): Point {
	const length = Math.sqrt(v.x * v.x + v.y * v.y);
	if (length === 0) return { x: 0, y: 0 };
	return { x: v.x / length, y: v.y / length };
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function calculateOptimalSegments(distanceMil: number, widthDeltaMil: number): number {
	const distanceMm = distanceMil / MIL_PER_MM;
	const widthDeltaMm = Math.abs(widthDeltaMil) / MIL_PER_MM;
	
	const segmentsByLength = Math.floor(distanceMm / CONFIG.MIN_SEGMENT_LENGTH_MM);
	const segmentsByWidth = Math.floor(widthDeltaMm / CONFIG.MIN_WIDTH_CHANGE_MM);
	let segments = Math.min(segmentsByLength, segmentsByWidth);
	segments = Math.max(1, segments);
	segments = Math.min(CONFIG.MAX_SEGMENTS, segments);
	return segments;
}

function showMessage(content: string, title: string): void {
	eda.sys_Dialog.showInformationMessage(content, title);
}

// ============================================================================
// Core Transition Logic
// ============================================================================

async function createSteppedTransitionLines(
	net: string,
	layer: string,
	p1: Point,
	w1: number,
	p2: Point,
	w2: number
): Promise<number> {
	let createdCount = 0;

	const distance = getDistance(p1, p2);
	const widthDelta = w2 - w1;

	if (distance < 1) {
		showMessage('起点和终点距离太近，无法创建过渡。', '警告');
		return 0;
	}

	const numSegments = calculateOptimalSegments(distance, widthDelta);
	const direction = normalizeVector({ x: p2.x - p1.x, y: p2.y - p1.y });
	const segmentLength = distance / numSegments;

	// console.log removed

	for (let i = 0; i < numSegments; i++) {
		const t1 = i / numSegments;
		const t2 = (i + 1) / numSegments;

		const startX = p1.x + direction.x * segmentLength * i;
		const startY = p1.y + direction.y * segmentLength * i;
		const endX = p1.x + direction.x * segmentLength * (i + 1);
		const endY = p1.y + direction.y * segmentLength * (i + 1);

		const midT = (t1 + t2) / 2;
		const segmentWidth = lerp(w1, w2, midT);

		try {
			const result = await eda.pcb_PrimitiveLine.create(
				net,
				layer as eda.TPCB_LayersOfLine,
				startX,
				startY,
				endX,
				endY,
				segmentWidth,
				false
			);

			if (result) {
				createdCount++;
			}
		} catch (error) {
			console.error(`[UniformTransition] Failed to create segment ${i + 1}:`, error);
		}
	}

	return createdCount;
}

/**
 * Creates stepped transition with user-specified segment count
 */
async function createSteppedTransitionLinesWithSegments(
	net: string,
	layer: string,
	p1: Point,
	w1: number,
	p2: Point,
	w2: number,
	numSegments: number
): Promise<number> {
	let createdCount = 0;

	const distance = getDistance(p1, p2);

	if (distance < 1) {
		showMessage('起点和终点距离太近，无法创建过渡。', '警告');
		return 0;
	}

	const direction = normalizeVector({ x: p2.x - p1.x, y: p2.y - p1.y });
	const segmentLength = distance / numSegments;

	// console.log removed

	for (let i = 0; i < numSegments; i++) {
		const t1 = i / numSegments;
		const t2 = (i + 1) / numSegments;

		const startX = p1.x + direction.x * segmentLength * i;
		const startY = p1.y + direction.y * segmentLength * i;
		const endX = p1.x + direction.x * segmentLength * (i + 1);
		const endY = p1.y + direction.y * segmentLength * (i + 1);

		const midT = (t1 + t2) / 2;
		const segmentWidth = lerp(w1, w2, midT);

		try {
			const result = await eda.pcb_PrimitiveLine.create(
				net,
				layer as eda.TPCB_LayersOfLine,
				startX,
				startY,
				endX,
				endY,
				segmentWidth,
				false
			);

			if (result) {
				createdCount++;
			}
		} catch (error) {
			console.error(`[UniformTransition] Failed to create segment ${i + 1}:`, error);
		}
	}

	return createdCount;
}

// ============================================================================
// Exported Menu Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {
	// Plugin activated
}

/**
 * Toggle unit between mm and mil
 */
export function toggleUnit(): void {
	currentUnit = currentUnit === 'mm' ? 'mil' : 'mm';
	showMessage(`单位已切换为: ${currentUnit}`, '单位设置');
}

/**
 * Main function: create stepped transition
 */
export async function createSteppedTransition(): Promise<void> {

	try {
		const selectedPrimitives = await eda.pcb_SelectControl.getSelectedPrimitives();
		
		if (!selectedPrimitives || selectedPrimitives.length === 0) {
			showMessage('请选中两条导线 (Track)，然后再运行此功能。', '未选中导线');
			return;
		}

		const selectedLines = selectedPrimitives.filter((p: any) => {
			const pType = p.pcbItemPrimitiveType;
			return pType && pType.toUpperCase() === 'TRACK';
		}) as LinePrimitive[];

		if (selectedLines.length === 0) {
			const typesFound = selectedPrimitives.map((p: any) => p.pcbItemPrimitiveType || 'unknown');
			showMessage(`请选中导线 (Track)。当前选中的对象类型: ${typesFound.join(', ')}`, '对象类型错误');
			return;
		}

		if (selectedLines.length !== 2) {
			showMessage(`请选中 两条 导线。当前选中了 ${selectedLines.length} 条导线。`, '选中数量错误');
			return;
		}

		await handleTwoLinesTransition(selectedLines[0], selectedLines[1]);
	} catch (error) {
		showMessage(`发生错误: ${String(error)}`, '错误');
	}
}

// Single line transition mode removed in v1.1.0 in favor of two-line mode

async function handleTwoLinesTransition(line1: LinePrimitive, line2: LinePrimitive): Promise<void> {

	if (line1.layerId !== line2.layerId) {
		showMessage('两条导线必须在同一层上才能创建过渡。', '图层不匹配');
		return;
	}

	// Find closest endpoints automatically
	const endpoints1 = [
		{ x: line1.startX, y: line1.startY },
		{ x: line1.endX, y: line1.endY },
	];
	const endpoints2 = [
		{ x: line2.startX, y: line2.startY },
		{ x: line2.endX, y: line2.endY },
	];

	let minDist = Infinity;
	let p1 = endpoints1[0];
	let p2 = endpoints2[0];

	for (const ep1 of endpoints1) {
		for (const ep2 of endpoints2) {
			const dist = getDistance(ep1, ep2);
			if (dist < minDist) {
				minDist = dist;
				p1 = ep1;
				p2 = ep2;
			}
		}
	}

	const distanceMm = fromMil(minDist, 'mm');

	if (minDist < 1) {
		showMessage('两条导线已经相连，无需创建过渡。', '无操作');
		return;
	}

	if (distanceMm > 100) {
		showMessage(`两条导线距离过远 (${distanceMm.toFixed(2)}mm)。`, '距离过远');
		return;
	}

	const net = line1.net || line2.net || '';
	const w1 = line1.width;
	const w2 = line2.width;

	// Calculate suggested segments
	const autoSegments = calculateOptimalSegments(minDist, Math.abs(w2 - w1));

	// Show segment count input
	eda.sys_Dialog.showInputDialog(
		`请输入阶梯段数 (1-${CONFIG.MAX_SEGMENTS}):`,
		`宽度: ${formatValue(w1)} → ${formatValue(w2)}\n距离: ${formatValue(minDist)}\n建议段数: ${autoSegments}`,
		'阶梯段数',
		'number',
		autoSegments.toString(),
		{ min: 1, max: CONFIG.MAX_SEGMENTS, step: 1 },
		async (segmentStr: string | null) => {
			
			if (!segmentStr) return;
			const segments = parseInt(segmentStr, 10);
			if (isNaN(segments) || segments < 1 || segments > CONFIG.MAX_SEGMENTS) {
				showMessage(`请输入 1 到 ${CONFIG.MAX_SEGMENTS} 之间的整数。`, '输入错误');
				return;
			}

			const createdCount = await createSteppedTransitionLinesWithSegments(
				net,
				line1.layerId,
				p1,
				w1,
				p2,
				w2,
				segments
			);

			if (createdCount > 0) {
				showMessage(
					`成功创建 ${createdCount} 段过渡导线。\n` +
					`${formatValue(w1)} → ${formatValue(w2)}`,
					'完成'
				);
			} else {
				showMessage('未能创建过渡线段。', '失败');
			}
		}
	);
}

export function about(): void {
	showMessage(
		`均匀线宽过渡插件 v${extensionConfig.version}\n\n` +
			'功能：在 PCB 编辑器中创建两种线宽之间的均匀过渡布线。\n\n' +
			`当前单位: ${currentUnit}\n` +
			`默认目标宽度: ${CONFIG.DEFAULT_TARGET_WIDTH_MM}mm\n` +
			`默认过渡长度: ${CONFIG.DEFAULT_TRANSITION_LENGTH_MM}mm`,
		'关于'
	);
}
