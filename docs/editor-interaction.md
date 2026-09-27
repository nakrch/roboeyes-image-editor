# Editor interaction

ブラウザ editor の操作仕様です。画面構成は #169、stage 上の編集と回転は #177、slider の wheel 操作は #179、inspector の section 切り替えは #182 に対応します。

## 画面構成

Header に Undo / Redo / Reset / Export を置き、desktop では左に outline、中央に specimen stage、右に選択中の 1 section を表示する inspector を並べます。outline は FACE（Display、Eyes、Expression）/ MOTION / LIBRARY（Presets）/ OUTPUT（Export）の順で、先頭の Display に解像度 preset、canvas width / height、transparent background、円形 display mask、sphere lens、Pixel perfect をまとめます。desktop の outline / stage / inspector はそれぞれ縦スクロールできます。幅 860 px 以下では header → sticky stage → 横スクロールする section tabs → inspector の順に積み、inspector は独立スクロールせず page をスクロールします。

実装: `src/ui/editor/EditorShell.tsx`（`navigation`、`content`）、`src/ui/sections/FaceSections.tsx`（`DisplaySection`）、`src/styles/shell.css`（`.re-workspace`、`@media (max-width: 860px)`）。

## Specimen stage

通常の拡大 preview は表示領域に収まる最大の整数倍率を使い、上限は **8×** です。1× 未満にしか収まらない場合だけ小数倍率を使います。Display の Pixel perfect を選ぶと拡大 preview 自体が 1× になります。別に実寸の `1× / ACTUAL SIZE` preview があり、これは inspection 専用です。caption は `W × H px · transparent|opaque · N×` 形式で、円形 mask が有効なら ` · circle mask` を付けます。再生 transport は stage の下に置きます。

拡大 preview の eye を drag すると canvas 座標に変換して位置を更新します。linked は 2 眼を剛体として動かし、independent はつかんだ眼だけを動かし、single-eye layout は 1 眼を動かします。Position slider と共通の安全範囲 helper で移動先を制限します。pointer-down から終了までを 1 回の連続編集として扱うため、1 drag が 1 undo step です。実寸 1× preview には drag handler がありません。

実装: `src/ui/stage/SpecimenStage.tsx`（`fit`、`scale`、caption、pointer handlers）、`src/ui/editor/stageDrag.ts`（`applyStageDrag`）、`src/ui/editor/eyePositionSafety.ts`（`rigidEyePositionRange`、`setIndependentEyePositionSafely`）、`src/ui/editor/useEditorController.ts`（`continuousEdit`）。

## Rotation pivot

Eyes の Rotation pivot は `local`（linked 時は両眼の中心点の中点、それ以外は対象眼の中心）と `display`（canvas の中心）を選択します。回転は editor 側で既存の eye geometry の `position` と `rotation` に反映します。pivot を model や renderer に追加しません。

実装: `src/ui/controls/EyeControls.tsx`（`rotationPivotRow`）、`src/ui/editor/modelEditing.ts`（`RotationPivot`、`pairRotationCenter`、`rotatePair`）、`src/ui/editor/eyeRotationSafety.ts`（`applyRotation`）。

## Numeric slider の wheel 操作

focus 中の range slider だけが wheel を消費し、focus のない slider は page scroll を妨げません。wheel 上方向または右方向で値を増やします。notch 相当の event はすぐに step を進め、小さい delta は合計 100 CSS px ごとに 1 step にします。`step="any"` では値域のおよそ 1/100 を覆う 1-2-5 系列の step を `[0.01, 1]` に収めて使い、Shift 中は step を 10 倍にします。

連続した wheel 操作は 1 undo step にまとめ、最後の wheel event から 400 ms 操作がなければ閉じます。pointer / key 操作または blur は残っている wheel sequence を先に閉じます。

実装: `src/ui/controls/NumericControl.tsx`（focus 判定、gesture handlers）、`src/ui/controls/wheelSliderStep.ts`（`wheelStepSize`、`consumeWheelSteps`、`WheelSliderSession`）。

## Inspector の section 切り替え

Desktop の inspector で末尾または先頭までスクロールした後、さらに同じ方向に wheel を **240 px**（`SECTION_OVERSCROLL_THRESHOLD_PX`）分動かすと次または前の section に切り替えます。端から端への wrap はありません。次の section は先頭、前の section は末尾から開きます。途中で内容がスクロールした場合、wheel の向きを反転した場合、または wheel が **350 ms** 以上止まった場合には蓄積をリセットします。切り替え後に lock はなく、連続した wheel 操作でも section ごとに改めて detent を満たせば進みます。

末尾の `NEXT` row は click でも次の section を開き、edge での蓄積は細い progress line に表示します。inspector に `overscroll-behavior-y: contain` を指定し、focus 中の slider が消費した wheel は inspector の切り替えには使いません。幅 860 px 以下では inspector の独立スクロールを解除し、通常の page scroll を維持します。

実装: `src/ui/editor/sectionOverscroll.ts`（`SectionOverscrollTracker`）、`src/ui/editor/useSectionOverscroll.ts`（edge 判定、section 切り替え）、`src/ui/editor/SectionOverscrollIndicators.tsx`（`NEXT`、progress）、`src/styles/shell.css`（`.re-inspector`、responsive layout）。
