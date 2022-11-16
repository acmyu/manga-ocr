import sys

import cv2
import numpy as np
import pandas as pd
import pytesseract
from PIL import Image
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


def get_params():
    params = ""
    params += "--psm 12"

    configParams = []
    def configParam(param, val):
      return "-c " + param + "=" + val

    configParams.append(("chop_enable", "T"))
    configParams.append(('use_new_state_cost','F'))
    configParams.append(('segment_segcost_rating','F'))
    configParams.append(('enable_new_segsearch','0'))
    configParams.append(('textord_force_make_prop_words','F'))
    configParams.append(('tessedit_char_blacklist', '}><L'))
    configParams.append(('textord_debug_tabfind','0'))
    params += " ".join([configParam(p[0], p[1]) for p in configParams])
    return params
    
    
def get_blurbs(img):

  
  _, img_gray = cv2.threshold(img, 200, 255, cv2.THRESH_BINARY) 
  cv2.imshow("Binarization", img_gray)
  cv2.waitKey(0)

  img_gray = cv2.cvtColor(img_gray, cv2.COLOR_BGR2GRAY)
  img_gray = cv2.bitwise_not(cv2.adaptiveThreshold(img_gray, 255, cv2.THRESH_BINARY, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 75, 10))

  kernel = np.ones((2,2),np.uint8)
  img_gray = cv2.erode(img_gray, kernel,iterations = 2)
  img_gray = cv2.bitwise_not(img_gray)
  contours, hierarchy = cv2.findContours(img_gray, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

  
  mask = np.zeros_like(img)
  mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
  height, width, channel = img.shape
  
  
  
  t_child = []
  t_pruned = []
  
  pruned_contours = []
  pruned_hierarchy = []
  for i, cnt in enumerate(contours):
    area = cv2.contourArea(cnt)
    #if area > 100 and area < ((height / 3) * (width / 3)):
    if area > 100:
      pruned_contours.append(cnt)
      t_pruned.append(cnt)
    else:
      pruned_contours.append([])
      hier = hierarchy[0][i]
      # innermost contours
      if hier[2] == -1 and hier[3] != -1:
        hierarchy[0][hier[3]][2] = -1
      
  for cnt, hier in zip(pruned_contours, hierarchy[0]):
    if len(cnt) > 0:
        pruned_hierarchy.append(hier)
  
  level_2_contours = {}
  for hier in pruned_hierarchy:
    # innermost contours
    if hier[2] == -1 and hier[3] != -1:
      parent = pruned_contours[hier[3]]
      if len(parent) > 0 and hier[3] not in level_2_contours:
        level_2_contours[hier[3]] = parent
        
  level_2_contours = list(level_2_contours.values())
        
  for cnt, hier in zip(t_pruned, pruned_hierarchy):
    if hier[2] == -1 and hier[3] != -1:
        t_child.append(cnt)
        
  # find contours for the mask for a second pass after pruning the large and small contours
  cv2.drawContours(mask, level_2_contours, -1, (255,255,255), 1)
  contours2, hierarchy = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
  
  bubble_contours = []
  for cnt, hier in zip(contours2, hierarchy[0]):
    # innermost contours
    if hier[2] == -1:
        bubble_contours.append(cnt)

  
  
  
  t_full_mask = cv2.cvtColor(np.zeros_like(img), cv2.COLOR_BGR2GRAY)
  cv2.drawContours(t_full_mask, contours, -1, (255,255,255), 1)
  cv2.imshow("All Contours", t_full_mask)
  
  t_pruned_mask = cv2.cvtColor(np.zeros_like(img), cv2.COLOR_BGR2GRAY)
  cv2.drawContours(t_pruned_mask, t_pruned, -1, (255,255,255), 1)
  cv2.imshow("Pruned", t_pruned_mask)
  
  t_child_mask = cv2.cvtColor(np.zeros_like(img), cv2.COLOR_BGR2GRAY)
  cv2.drawContours(t_child_mask, t_child, -1, (255,255,255), 1)
  cv2.imshow("Innermost", t_child_mask)

  cv2.imshow("Mask", mask)
  
  final_mask = cv2.cvtColor(np.zeros_like(img), cv2.COLOR_BGR2GRAY)
  cv2.drawContours(final_mask, bubble_contours, -1, (255,255,255), 1)
  cv2.imshow("Final", final_mask)
  
  cv2.waitKey(0)
  
  
  
  
  print(len(bubble_contours))
  count = 0

  blurbs = []
  for cnt in bubble_contours:
    area = cv2.contourArea(cnt)
    #if area > 1000 and area < ((height / 3) * (width / 3)):
    if area > 100 and area < ((height * 0.95) * (width * 0.95)):
        draw_mask = cv2.cvtColor(np.zeros_like(img), cv2.COLOR_BGR2GRAY)
        approx = cv2.approxPolyDP(cnt,0.01*cv2.arcLength(cnt,True),True)
        # pickle.dump(approx, open("approx.pkl", mode="w"))
        cv2.fillPoly(draw_mask, [approx], (255,0,0))
        image = cv2.bitwise_and(draw_mask, cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
        # draw_mask_inverted = cv2.bitwise_not(draw_mask)
        # image = cv2.bitwise_or(image, draw_mask_inverted)
        y = approx[:, 0, 1].min()
        h = approx[:, 0, 1].max() - y
        x = approx[:, 0, 0].min()
        w = approx[:, 0, 0].max() - x
        image = image[y:y+h, x:x+w]
        
        pil_image = Image.fromarray(image)
        #text = pytesseract.image_to_string(pil_image, lang="jpn_vert", config=get_params())
        
        """
        text = pytesseract.image_to_data(pil_image, lang="jpn_vert", config=get_params(), output_type='data.frame')
        #text = text[text.conf > 70]
        lines = text.groupby('block_num')['text'].apply(list)
        conf = text.groupby(['block_num'])['conf'].mean()
        print("confidence: ", conf)
        print(lines)
        
        cv2.imshow("Segmented", image)
        cv2.waitKey(0)
        """
    

        
        pil_image = Image.fromarray(image)
        text = pytesseract.image_to_string(pil_image, lang="jpn_vert", config=get_params())
        if text:
            print(text)
            count+=1
        #cv2.imshow("Segmented", image)
        #cv2.waitKey(0)
        
        

  print(count)
  

 
get_blurbs(cv2.imread("img.jpg"))
