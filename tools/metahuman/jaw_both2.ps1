# doc 177 §19: jawline by the pupil distance (eye corners were unreliable): widen the jaw, lower face back
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:LOWER_FACE_K = '1.0'; $env:SYMMETRIZE = '1'; $env:UPPER_LID_DROP = '-1.8'; $env:LOWER_LID_RAISE = '0'; $env:JAW_NARROW = '1.07'; $env:CHIN_NARROW = '1.08'
& $bl -b -P C:\w\hwanghon\tools\metahuman\wrap_template.py -- C:/w/mhlab/template_Archetype.fbx C:/w/mhlab/ain2_head.glb C:/w/mhlab/ain_wrapped_jaw.fbx C:/w/mhlab/ain_wrap_jaw_preview.png 2>$null | Select-String "^WRAP (lower|upper|jaw|sym|out)"
$env:UPPER_LID_DROP = '0'; $env:SYMMETRIZE = '0'; $env:JAW_NARROW = '1.0'; $env:CHIN_NARROW = '1.0'; $env:MH_FACE_BC = ''
& C:\w\mhlab\jaw_chain.ps1 -Name Ain -Hair WI_Hair_M_SideSweptFringe -HairParams "Melanin=1,Redness=0.05" -IrisTint "1.0,0.15,0.1" -IrisSat "3.0" -Brow "" -BrowParams "" -Cap "1" -Darken "1"
$env:LOWER_FACE_K = '1.03'; $env:SYMMETRIZE = '1'; $env:UPPER_LID_DROP = '3.5'; $env:LOWER_LID_RAISE = '1.0'; $env:JAW_NARROW = '1.04'; $env:CHIN_NARROW = '1.0'
& $bl -b -P C:\w\hwanghon\tools\metahuman\wrap_template.py -- C:/w/mhlab/template_Archetype.fbx C:/w/mhlab/sera2_head.glb C:/w/mhlab/sera_wrapped_jaw.fbx C:/w/mhlab/sera_wrap_jaw_preview.png 2>$null | Select-String "^WRAP (lower|upper|jaw|sym|out)"
$env:UPPER_LID_DROP = '0'; $env:LOWER_LID_RAISE = '0'; $env:SYMMETRIZE = '0'; $env:JAW_NARROW = '1.0'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_straight.png'
& C:\w\mhlab\jaw_chain.ps1 -Name Sera -Hair WI_Hair_L_Straight -HairParams "Melanin=0,Whiteness=1,Redness=0" -IrisTint "0.85,0.88,0.9" -IrisSat "0.3" -Brow "" -BrowParams "" -Cap "0" -Darken "0" -UseHairMesh "0"
