# doc 177 §16: whole-rig DNA swap with the Y/Z swap fixed - both heroes again from their wraps
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:LOWER_FACE_K = '1.024'; $env:UPPER_LID_DROP = '0'
& $bl -b -P C:\w\hwanghon\tools\metahuman\wrap_template.py -- C:/w/mhlab/template_Archetype.fbx C:/w/mhlab/ain2_head.glb C:/w/mhlab/ain_wrapped_jaw.fbx C:/w/mhlab/ain_wrap_jaw_preview.png 2>$null | Select-String "^WRAP (lower|out)"
$env:MH_FACE_BC = ''
& C:\w\mhlab\jaw_chain.ps1 -Name Ain -Hair WI_Hair_M_SideSweptFringe -HairParams "Melanin=1,Redness=0.05" -IrisTint "1.0,0.15,0.1" -IrisSat "3.0" -Brow "" -BrowParams "" -Cap "1" -Darken "1"
$env:LOWER_FACE_K = '1.128'; $env:UPPER_LID_DROP = '1.8'
& $bl -b -P C:\w\hwanghon\tools\metahuman\wrap_template.py -- C:/w/mhlab/template_Archetype.fbx C:/w/mhlab/sera2_head.glb C:/w/mhlab/sera_wrapped_jaw.fbx C:/w/mhlab/sera_wrap_jaw_preview.png 2>$null | Select-String "^WRAP (lower|upper|out)"
$env:UPPER_LID_DROP = '0'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_straight.png'
& C:\w\mhlab\jaw_chain.ps1 -Name Sera -Hair WI_Hair_L_Straight -HairParams "Melanin=0,Whiteness=1,Redness=0" -IrisTint "0.85,0.88,0.9" -IrisSat "0.3" -Brow "" -BrowParams "" -Cap "0" -Darken "0" -UseHairMesh "0"
