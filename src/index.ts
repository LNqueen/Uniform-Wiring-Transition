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

/** Declaring eda as any to fix linting in environment where it's global */
declare const eda: any;

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

interface TrackPrimitive {
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
	// Arc specific
	arcAngle?: number;
}

function getDistance(p1: Point, p2: Point): number {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function normalizeVector(v: Point): Point {
	const length = Math.sqrt(v.x * v.x + v.y * v.y);
	if (length === 0) return { x: 0, y: 0 };
	return { x: v.x / length, y: v.y / length };
}

function isSamePoint(p1: Point, p2: Point, tolerance = 1): boolean {
	return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
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
// Coordinate & Property Helpers
// ============================================================================

function getVal(obj: any, key: string): any {
	let val: any;
	if (obj[key] !== undefined) {
		val = obj[key];
	} else {
		const method = 'getState_' + key.charAt(0).toUpperCase() + key.slice(1);
		if (typeof obj[method] === 'function') {
			val = obj[method]();
		}
	}

	// x10 Scaling logic removed - API returns correct units now.
	const type = String(obj.pcbItemPrimitiveType || '').toUpperCase();
	if (type.includes('ARCTRACK') || type === 'ARC') {
		if (key === 'arcAngle') {
			// Convert radians to degrees if it looks like radians (small value)
			const numVal = Number(val);
			if (Math.abs(numVal) < 7) { // Radians are usually < 2pi
				return numVal * (180 / Math.PI);
			}
		}
	}

	// Special cases for width
	if (key === 'width' && val === undefined) val = obj['lineWidth'];
	
	return val;
}

function getTrackPoint(track: any, isEnd: boolean): Point {
	const prefix = isEnd ? 'end' : 'start';
	const x = Number(getVal(track, prefix + 'X'));
	const y = Number(getVal(track, prefix + 'Y'));
	
	if (isNaN(x) || isNaN(y)) {
		console.error(`[UniformTransition] Invalid coordinate for ${track.pcbItemPrimitiveType} ${prefix}: ${x}, ${y}`);
		return { x: 0, y: 0 }; // Return 0,0 to avoid crashing, but this will cause distance errors
	}
	return { x, y };
}

function getTrackWidth(track: any): number {
	let w = Number(getVal(track, 'width') || getVal(track, 'lineWidth') || 10);
	
	const type = String(track.pcbItemPrimitiveType || '').toUpperCase();
	if (type.includes('ARCTRACK') || type === 'ARC') { 
		// Width is returned in 0.1mil units? Or just needs scaling.
		// User report: 0.203mm track reads as 0.020mm if not scaled.
		w = w * 10; 
	}
	return w;
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
				layer as any,
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
 * Creates stepped arc transition
 */
async function createSteppedTransitionArcsWithSegments(
	net: string,
	layer: string,
	p1: Point,
	p2: Point,
	w1: number,
	w2: number,
	numSegments: number,
	center: Point,
	startAngle: number,
	totalSweep: number
): Promise<number> {
	let createdCount = 0;
	const radius = getDistance(p1, center);

	for (let i = 0; i < numSegments; i++) {
		const t1 = i / numSegments;
		const t2 = (i + 1) / numSegments;

		const angle1 = startAngle + totalSweep * t1;
		const angle2 = startAngle + totalSweep * t2;

		const startX = center.x + radius * Math.cos(angle1);
		const startY = center.y + radius * Math.sin(angle1);
		const endX = center.x + radius * Math.cos(angle2);
		const endY = center.y + radius * Math.sin(angle2);

		const segmentWidth = lerp(w1, w2, (t1 + t2) / 2);
		const segmentSweep = (totalSweep * 180) / Math.PI / numSegments;

		try {
			const result = await eda.pcb_PrimitiveArc.create(
				net,
				layer as any,
				startX,
				startY,
				endX,
				endY,
				segmentSweep,
				segmentWidth,
				0, // EPCB_PrimitiveArcInteractiveMode.NONE
				false // Locked
			);

			if (result) {
				createdCount++;
			}
		} catch (error) {
			console.error(`[UniformTransition] Failed to create arc segment ${i + 1}:`, error);
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

// function rotateVector removed
// function getTrackDirection removed
// function calculateArcAngle removed
// function isParallel removed

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
			showMessage('请选中两条导线 (Track/Arc)，然后再运行此功能。', '未选中导线');
			return;
		}

		const selectedTracks = selectedPrimitives.filter((p: any) => {
			const pType = (p.pcbItemPrimitiveType || '').toUpperCase();
			return pType.includes('TRACK') || pType.includes('ARC') || pType.includes('LEAD');
		}) as TrackPrimitive[];


		if (selectedTracks.length < 2) {
			showMessage('请至少选中 2 条导线，然后再运行此功能。', '选中数量不足');
			return;
		}



		// Gap Detection via Dangling Endpoints:
		// 1. Collect all endpoints.
		// 2. An endpoint is "connected" if its coordinates match any OTHER track's endpoint (within tolerance).
		// 3. Find all "dangling" (not connected) endpoints.
		// 4. Find the closest pair of dangling endpoints belonging to different tracks.

		const CONNECT_TOLERANCE = 0.5; // mil

		const allEndpoints: { point: Point, track: TrackPrimitive }[] = [];
		selectedTracks.forEach(t => {
			allEndpoints.push({ point: getTrackPoint(t, false), track: t });
			allEndpoints.push({ point: getTrackPoint(t, true),  track: t });
		});

		// Find dangling endpoints (not connected to any other track)
		const danglingEndpoints = allEndpoints.filter((ep1, i) => {
			for (let j = 0; j < allEndpoints.length; j++) {
				if (i === j) continue;
				if (ep1.track === allEndpoints[j].track) continue; // Skip same track's own endpoints
				
				const dist = getDistance(ep1.point, allEndpoints[j].point);
				if (dist < CONNECT_TOLERANCE) {
					return false; // Connected to another track
				}
			}
			return true; // Dangling
		});

		if (danglingEndpoints.length < 2) {
			showMessage('所有选中的导线都已相连，没有断开的端点。\n\n请选择包含断开缺口的导线组合。', '无悬空端点');
			return;
		}

		// Find closest pair among dangling endpoints
		let bestP1: Point | null = null;
		let bestP2: Point | null = null;
		let bestT1: TrackPrimitive | null = null;
		let bestT2: TrackPrimitive | null = null;
		let minGap = Infinity;

		for (let i = 0; i < danglingEndpoints.length; i++) {
			for (let j = i + 1; j < danglingEndpoints.length; j++) {
				const ep1 = danglingEndpoints[i];
				const ep2 = danglingEndpoints[j];

				if (ep1.track === ep2.track) continue; // Skip endpoints from the same track

				const dist = getDistance(ep1.point, ep2.point);
				if (dist < minGap) {
					minGap = dist;
					bestP1 = ep1.point;
					bestP2 = ep2.point;
					bestT1 = ep1.track;
					bestT2 = ep2.track;
				}
			}
		}

		if (!bestP1 || !bestP2 || !bestT1 || !bestT2) {
			showMessage('无法在选中的导线中找到合适的连接断点。\n\n请确保选中的线段中包含断开的缺口，且坐标数据有效。', '未找到断点');
			return;
		}

		// Layer check
		if (bestT1.layerId !== bestT2.layerId) {
			showMessage('两条导线必须在同一层上才能创建过渡。', '图层不匹配');
			return;
		}

		const net = bestT1.net || bestT2.net || '';
		const w1 = getTrackWidth(bestT1);
		const w2 = getTrackWidth(bestT2);
		const layerId = bestT1.layerId;
		const distanceMm = fromMil(minGap, 'mm');
		const autoSegments = calculateOptimalSegments(minGap, Math.abs(w2 - w1));

		// Show dialog with gap info
		const p1Str = `${fromMil(bestP1.x, currentUnit).toFixed(2)},${fromMil(bestP1.y, currentUnit).toFixed(2)}`;
		const p2Str = `${fromMil(bestP2.x, currentUnit).toFixed(2)},${fromMil(bestP2.y, currentUnit).toFixed(2)}`;
		
		const finalP1 = bestP1;
		const finalP2 = bestP2;
		const finalW1 = w1;
		const finalW2 = w2;
		const finalLayer = layerId;

		eda.sys_Dialog.showInputDialog(
			`请输入阶梯段数 (1-${CONFIG.MAX_SEGMENTS}):`,
			`宽度: ${formatValue(w1)} → ${formatValue(w2)}\n距离: ${formatValue(minGap)}\n` + 
			`连接点: (${p1Str}) <-- ${distanceMm.toFixed(2)}mm --> (${p2Str})`,
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

				const createdCount = await createSteppedTransitionLinesWithSegments(net, finalLayer, finalP1, finalW1, finalP2, finalW2, segments);

				if (createdCount > 0) {
					showMessage(`成功创建 ${createdCount} 段过渡导线。`, '完成');
				}
			}
		);
	} catch (error) {
		showMessage(`发生错误: ${String(error)}`, '错误');
	}
}

// Single line transition mode removed in v1.1.0 in favor of two-line mode

// Debug function removed

async function handleTwoTracksTransition(track1: TrackPrimitive, track2: TrackPrimitive): Promise<void> {
	if (track1.layerId !== track2.layerId) {
		showMessage('两条导线必须在同一层上才能创建过渡。', '图层不匹配');
		return;
	}

	// Find closest endpoints
	const p1s = getTrackPoint(track1, false);
	const p1e = getTrackPoint(track1, true);
	const p2s = getTrackPoint(track2, false);
	const p2e = getTrackPoint(track2, true);

	// DEBUG removed

	const endpoints1 = [p1s, p1e];
	const endpoints2 = [p2s, p2e];

	let minDist = Infinity;
	let p1: Point | null = null;
	let p2: Point | null = null;
	let p1Idx = 0;
	let p2Idx = 0;

	for (let i = 0; i < 2; i++) {
		for (let j = 0; j < 2; j++) {
			const dist = getDistance(endpoints1[i], endpoints2[j]);
			if (!isNaN(dist) && dist < minDist) {
				minDist = dist;
				p1 = endpoints1[i];
				p2 = endpoints2[j];
				p1Idx = i;
				p2Idx = j;
			}
		}
	}

	if (!p1 || !p2) {
		showMessage('无法计算导线端点距离，可能是坐标数据无效。', '计算错误');
		return;
	}

	const distanceMm = fromMil(minDist, 'mm');

	if (minDist < 1) {
		showMessage('两条导线已经相连，无需创建过渡。', '无操作');
		return;
	}

	// Calculate suggested segments
	const net = track1.net || track2.net || '';
	const w1 = getTrackWidth(track1);
	const w2 = getTrackWidth(track2);

	const autoSegments = calculateOptimalSegments(minDist, Math.abs(w2 - w1));

	// Show dialog
	// Debug info in dialog
	const p1Str = `${fromMil(p1!.x, currentUnit).toFixed(2)},${fromMil(p1!.y, currentUnit).toFixed(2)}`;
	const p2Str = `${fromMil(p2!.x, currentUnit).toFixed(2)},${fromMil(p2!.y, currentUnit).toFixed(2)}`;

	eda.sys_Dialog.showInputDialog(
		`请输入阶梯段数 (1-${CONFIG.MAX_SEGMENTS}):`,
		`宽度: ${formatValue(w1)} → ${formatValue(w2)}\n距离: ${formatValue(minDist)}\n` + 
		`连接点: (${p1Str}) <-- ${distanceMm.toFixed(2)}mm --> (${p2Str})`,
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

			const createdCount = await createSteppedTransitionLinesWithSegments(net, track1.layerId, p1, w1, p2, w2, segments);

			if (createdCount > 0) {
				showMessage(`成功创建 ${createdCount} 段过渡导线。`, '完成');
			}
		}
	);
}

export function about(): void {
	showMessage(
		`均匀线宽过渡插件 v1.2.0\n\n` +
			'功能：在 PCB 编辑器中创建直线与直线、直线与圆弧之间的平滑过渡。\n' +
			'支持：智能识别非平行导线并自动采用圆弧/曲线过渡。\n\n' +
			`当前单位: ${currentUnit}`,
		'关于'
	);
}
